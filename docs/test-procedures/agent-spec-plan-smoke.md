# US-0181 Manual Smoke Test Procedure

End-to-end manual test for the Pre-Dispatch Spec & Plan Orchestration engine with real Claude agents.

**Prerequisites:**

- `feature/US-0181-pre-dispatch-orchestration` branch checked out (or merged to develop)
- Optional: superpowers plugin installed
- Test story added to `docs/RELEASE_PLAN.md` (e.g. `US-9999 — Smoke test story`)

## Procedure

### 1. Setup

```bash
node tools/agent-spec-plan.js status --story US-9999  # confirm story exists, no orchestration state yet
```

### 2. Start spec phase

Tell DM_AGENT: "Start spec phase for US-9999"

DM_AGENT should:

- Call `node tools/agent-spec-plan.js spec-start --story US-9999`
- Spawn Compass (logged via `agent-start`)
- Compass invokes brainstorming (skill if installed, otherwise manual dialogue)
- Compass writes ACs to `docs/superpowers/specs/<date>-us-9999-design.md`
- Compass sets `uiSurface` and `specPath` via `spec-update`
- Compass calls `spec-await-ac` → exit 2 → orchestration pauses

**Verify:**

- `node tools/agent-spec-plan.js status --story US-9999` shows `specPhase.state: awaiting_ac_approval`
- Dashboard "Pending Approvals" widget shows US-9999 AC review row

### 3. Approve ACs (try CLI fast-path)

```bash
node tools/agent-spec-plan.js approve --story US-9999 --gate ac
```

**Verify:** `acApprovedAt` is now set; `specPhase.state: in_progress`.

### 4. Continue spec phase

DM_AGENT should:

- If uiSurface: spawn Palette → spawn Pixel (interactive mockup)
- Spawn Keystone (technical design)
- Spawn Lens for spec review with structured findings template

If Lens emits REQUEST_CHANGES:

- DM_AGENT parses findings, routes by `@persona` primary tag, re-engages owner, re-spawns Lens
- Loops until APPROVED OR cap (3) reached

If APPROVED: DM_AGENT calls `spec-await-final` → exit 2.

### 5. Approve final spec (try dashboard path)

- Open `docs/plan-status.html` in browser
- Status tab → Pending Approvals widget → US-9999 row → click "Approve"
- Browser downloads `approve-US-9999-spec.flag`
- Move flag to `docs/pending-approvals/`
- Run `node tools/generate-plan.js` (or `npm run plan`)

**Verify:**

- Flag file is deleted from `docs/pending-approvals/` after apply
- `specPhase.state: approved`
- Dashboard widget no longer shows US-9999 spec row

### 6. Plan phase

DM_AGENT should:

- Call `plan-start --author Keystone`
- Spawn Keystone for plan writing (writing-plans skill or manual)
- Keystone self-reviews
- Spawn Lens for plan review
- Loop on REQUEST_CHANGES (cap 3)
- On APPROVED → `plan-await-approval`

### 7. Approve plan

```bash
node tools/agent-spec-plan.js approve --story US-9999 --gate plan
node tools/agent-spec-plan.js list --state ready_for_dispatch
```

US-9999 should appear in ready_for_dispatch.

### 8. Sad path tests

Repeat with these variants:

- **Spec gap kickback:** during plan phase, have Keystone call `plan-spec-gap --reason "AC missing edge case"`. Verify spec phase reopens, plan resets.
- **Iteration cap:** issue `spec-review-result --verdict REQUEST_CHANGES` 3 times. Verify auto-escalation, exit 1.
- **Rejection:** Approve AC, then reject final spec with `reject --gate spec --reason "scope creep"`. Verify spec returns to `in_progress`.

### 9. Tiered fallback test

- Disable superpowers temporarily: `mv ~/.claude/plugins/cache/claude-plugins-official/superpowers /tmp/sp-disabled`
- Repeat steps 1-7 with manual protocol from PO_AGENT.md and ARCHITECT_AGENT.md
- Verify everything works
- Restore: `mv /tmp/sp-disabled ~/.claude/plugins/cache/claude-plugins-official/superpowers`

## Pass criteria

- Happy path completes: story reaches `ready_for_dispatch`
- Spec gap kickback works
- Iteration cap escalates correctly
- Both CLI and dashboard approval paths work
- With and without superpowers installed
- All flag files are cleaned up after successful application
- Malformed flag files are skipped with logged warnings (not deleted)
