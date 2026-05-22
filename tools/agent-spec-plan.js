#!/usr/bin/env node
'use strict';

/**
 * agent-spec-plan.js — CLI for the spec-plan orchestration gates.
 *
 * Post-Phase-D (US-0237 / TASK-0061) this tool no longer writes
 * docs/sdlc-status.json directly. Every state mutation routes through the
 * D.1 entity repos:
 *
 *   - repo.sdlcProgramme.set('stories', {...})  — story spec/plan phases
 *   - repo.sdlcEvents.record({ kind: 'spec-plan-*', ... })  — typed log
 *
 * The SdlcMirror re-renders `docs/sdlc-status.json` under a file lock on
 * every write, so the on-disk JSON is a pure function of SQL state
 * (writers throw, indexers warn — AC-1013).
 *
 * The `specApprove()` / `planApprove()` idempotency guards (AC-0929 —
 * tracked under US-0183) live verbatim in tools/lib/agent-spec-plan-state.js
 * and are exercised unchanged from this CLI. The guard short-circuits a
 * second approve on an already-approved story and returns the orchestration
 * unchanged, so the eventual mirror write is a no-op and the repo emits no
 * spurious event.
 */

const fs = require('fs');
const path = require('path');
const State = require('./lib/agent-spec-plan-state');
const Flags = require('./lib/agent-spec-plan-flags');
const { Repository } = require('./lib/repository');
const {
  resolveRoot,
  ensureDocsDir,
  adoptLegacySdlcPath,
  syncLegacySdlcPath,
  readMirror,
} = require('./lib/agent-cli-repo-helpers');

const ROOT = path.join(__dirname, '..');
const SDLC_PATH = path.join(ROOT, 'docs/sdlc-status.json');

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || null;
  const out = {
    cmd,
    story: null,
    gate: null,
    verdict: null,
    reason: null,
    field: null,
    value: null,
    findingsFile: null,
    author: null,
    dir: null,
    state: null,
    phase: null,
    uiSurface: null,
  };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--story' && next) {
      out.story = next;
      i++;
    } else if (a === '--gate' && next) {
      out.gate = next;
      i++;
    } else if (a === '--verdict' && next) {
      out.verdict = next;
      i++;
    } else if (a === '--reason' && next !== undefined) {
      out.reason = next;
      i++;
    } else if (a === '--field' && next) {
      out.field = next;
      i++;
    } else if (a === '--value' && next !== undefined) {
      out.value = next;
      i++;
    } else if (a === '--findings-file' && next) {
      out.findingsFile = next;
      i++;
    } else if (a === '--author' && next) {
      out.author = next;
      i++;
    } else if (a === '--dir' && next) {
      out.dir = next;
      i++;
    } else if (a === '--state' && next) {
      out.state = next;
      i++;
    } else if (a === '--phase' && next) {
      out.phase = next;
      i++;
    } else if (a === '--ui-surface' && next !== undefined) {
      out.uiSurface = next;
      i++;
    }
  }
  return out;
}

function ensureStory(stories, storyId) {
  const story = stories[storyId];
  if (!story) {
    throw new Error(`Story '${storyId}' not found in sdlc-status.json`);
  }
  return story;
}

function ensureOrchestration(story) {
  if (!story.specPhase || !story.planPhase) {
    const init = State.initStory();
    story.specPhase = init.specPhase;
    story.planPhase = init.planPhase;
    story.phaseHistory = init.phaseHistory;
  }
  return story;
}

function getOrchestration(story) {
  return {
    specPhase: story.specPhase,
    planPhase: story.planPhase,
    phaseHistory: story.phaseHistory || [],
  };
}

function applyOrchestration(story, newO) {
  story.specPhase = newO.specPhase;
  story.planPhase = newO.planPhase;
  story.phaseHistory = newO.phaseHistory;
}

// Read-only commands that don't need a dashboard regen after running.
const READ_ONLY_CMDS = new Set(['status', 'list', 'show-pending']);

/**
 * Silently regenerate the Agentic Dashboard after a state-mutating command.
 * Errors are swallowed — regen failure must never block the orchestration CLI.
 */
function regenDashboard(ctx = {}) {
  if (ctx.skipRegen) return; // test isolation: tests pass { skipRegen: true }
  try {
    const dashboardScript = path.join(ROOT, 'tools/generate-dashboard.js');
    if (fs.existsSync(dashboardScript)) {
      require('./generate-dashboard');
    }
  } catch {
    // silent — regen is best-effort
  }
}

/**
 * Materialise the `stories` map from SQL plus any pre-existing top-level
 * `stories` carried by the legacy on-disk JSON (test seeds). The repo is
 * the source of truth — but on the first call before any repo write, the
 * SQL `sdlc_programme.stories` row may not exist yet, so we fall back to
 * the on-disk JSON.
 *
 * Returns a fresh object (never the SQL row reference) so downstream
 * mutation does not leak back into the repo.
 */
function readStories(repo, root) {
  const fromSql = repo.sdlcProgramme.get('stories');
  if (fromSql && typeof fromSql === 'object') {
    return JSON.parse(JSON.stringify(fromSql));
  }
  const onDisk = readMirror(root);
  const legacyTopLevel = onDisk.stories && typeof onDisk.stories === 'object' ? onDisk.stories : {};
  // Some seeds put stories under programme.stories already — honour that
  // path even when the SQL row is absent.
  const legacyProgramme =
    onDisk.programme && onDisk.programme.stories && typeof onDisk.programme.stories === 'object'
      ? onDisk.programme.stories
      : {};
  return { ...legacyTopLevel, ...legacyProgramme };
}

/**
 * Persist the stories map back through the typed repos. The repo call writes
 * the SQLite row and triggers a mirror re-render under the file lock —
 * docs/sdlc-status.json is never written directly here.
 */
async function writeStories(repo, stories, evt) {
  await repo.sdlcProgramme.set('stories', stories);
  if (evt) {
    await repo.sdlcEvents.record({
      ts: Date.now(),
      ...evt,
    });
  }
}

async function dispatch(opts, ctx = {}) {
  const cmd = opts.cmd;

  const storyCmds = new Set([
    'spec-start',
    'spec-update',
    'spec-await-ac',
    'spec-await-final',
    'spec-review-result',
    'plan-start',
    'plan-update',
    'plan-spec-gap',
    'plan-review-result',
    'plan-await-approval',
    'approve',
    'reject',
    'escalate',
    'status',
  ]);
  if (storyCmds.has(cmd) && !opts.story) {
    console.error(`[agent-spec-plan] Command '${cmd}' requires --story US-XXXX`);
    return 1;
  }

  const root = resolveRoot(ctx, { defaultRoot: ROOT });
  ensureDocsDir(root);
  adoptLegacySdlcPath(ctx, root);

  Repository._reset();
  let repo;
  try {
    repo = Repository.getInstance({ root });
  } catch (e) {
    console.error(`[agent-spec-plan] cannot open repository: ${e.message}`);
    return 1;
  }

  try {
    const stories = readStories(repo, root);

    let story, orch, newOrch;
    if (storyCmds.has(cmd)) {
      story = ensureStory(stories, opts.story);
      ensureOrchestration(story);
      orch = getOrchestration(story);
    }

    switch (cmd) {
      case 'spec-start':
        newOrch = State.specStart(orch, { uiSurface: opts.uiSurface === 'true' });
        applyOrchestration(story, newOrch);
        await writeStories(repo, stories, {
          kind: 'spec-plan-spec-start',
          storyId: opts.story,
        });
        syncLegacySdlcPath(ctx, root);
        return 0;

      case 'spec-update':
        if (!opts.field) {
          console.error('--field required');
          return 1;
        }
        newOrch = State.specUpdate(orch, { field: opts.field, value: opts.value });
        applyOrchestration(story, newOrch);
        await writeStories(repo, stories, {
          kind: 'spec-plan-spec-update',
          storyId: opts.story,
          field: opts.field,
          value: opts.value,
        });
        syncLegacySdlcPath(ctx, root);
        return 0;

      case 'spec-await-ac':
        newOrch = State.specAwaitAc(orch);
        applyOrchestration(story, newOrch);
        await writeStories(repo, stories, {
          kind: 'spec-plan-spec-await-ac',
          storyId: opts.story,
        });
        syncLegacySdlcPath(ctx, root);
        return 2;

      case 'spec-review-result':
        newOrch = State.specReviewResult(orch, { verdict: opts.verdict });
        applyOrchestration(story, newOrch);
        await writeStories(repo, stories, {
          kind: 'spec-plan-spec-review-result',
          storyId: opts.story,
          verdict: opts.verdict,
        });
        syncLegacySdlcPath(ctx, root);
        if (story.specPhase.state === 'escalated') {
          console.error(
            `[agent-spec-plan] Iteration cap reached for spec phase. Story escalated. Manual resolution required.`,
          );
          return 1;
        }
        return 0;

      case 'spec-await-final':
        newOrch = State.specAwaitFinal(orch);
        applyOrchestration(story, newOrch);
        await writeStories(repo, stories, {
          kind: 'spec-plan-spec-await-final',
          storyId: opts.story,
        });
        syncLegacySdlcPath(ctx, root);
        return 2;

      case 'approve': {
        if (!opts.gate) {
          console.error('--gate required');
          return 1;
        }
        // AC-0929: specApprove() / planApprove() idempotency guards live in
        // agent-spec-plan-state.js — re-approving an already-approved gate
        // returns the orchestration unchanged. We DETECT that no-op here so
        // we don't emit a spurious event row (writers should reflect real
        // state change). Equality is structural since both helpers either
        // return the same object reference or a deep-cloned record.
        const prevOrch = orch;
        if (opts.gate === 'ac') newOrch = State.acApprove(orch);
        else if (opts.gate === 'spec') newOrch = State.specApprove(orch);
        else if (opts.gate === 'plan') newOrch = State.planApprove(orch);
        else {
          console.error(`Unknown gate '${opts.gate}'`);
          return 1;
        }
        applyOrchestration(story, newOrch);
        const noopIdempotent = newOrch === prevOrch;
        await writeStories(
          repo,
          stories,
          noopIdempotent
            ? null
            : {
                kind: 'spec-plan-approve',
                storyId: opts.story,
                gate: opts.gate,
              },
        );
        syncLegacySdlcPath(ctx, root);
        console.log(`[agent-spec-plan] Approved ${opts.gate} gate for ${opts.story}.`);
        return 0;
      }

      case 'reject':
        if (!opts.gate) {
          console.error('--gate required');
          return 1;
        }
        if (!opts.reason) {
          console.error('--reason required for reject');
          return 1;
        }
        if (opts.gate === 'ac') newOrch = State.acReject(orch, { reason: opts.reason });
        else if (opts.gate === 'spec') newOrch = State.specReject(orch, { reason: opts.reason });
        else if (opts.gate === 'plan') newOrch = State.planReject(orch, { reason: opts.reason });
        else {
          console.error(`Unknown gate '${opts.gate}'`);
          return 1;
        }
        applyOrchestration(story, newOrch);
        await writeStories(repo, stories, {
          kind: 'spec-plan-reject',
          storyId: opts.story,
          gate: opts.gate,
          reason: opts.reason,
        });
        syncLegacySdlcPath(ctx, root);
        console.log(`[agent-spec-plan] Rejected ${opts.gate} gate for ${opts.story}: ${opts.reason}`);
        return 0;

      case 'status':
        console.log(
          JSON.stringify(
            {
              story: opts.story,
              specPhase: story.specPhase,
              planPhase: story.planPhase,
              overall: State.deriveOverall(story.specPhase.state, story.planPhase.state),
            },
            null,
            2,
          ),
        );
        return 0;

      case 'plan-start':
        newOrch = State.planStart(orch, { author: opts.author });
        applyOrchestration(story, newOrch);
        await writeStories(repo, stories, {
          kind: 'spec-plan-plan-start',
          storyId: opts.story,
          author: opts.author,
        });
        syncLegacySdlcPath(ctx, root);
        return 0;

      case 'plan-update':
        if (!opts.field) {
          console.error('--field required');
          return 1;
        }
        newOrch = State.planUpdate(orch, { field: opts.field, value: opts.value });
        applyOrchestration(story, newOrch);
        await writeStories(repo, stories, {
          kind: 'spec-plan-plan-update',
          storyId: opts.story,
          field: opts.field,
          value: opts.value,
        });
        syncLegacySdlcPath(ctx, root);
        return 0;

      case 'plan-spec-gap':
        if (!opts.reason) {
          console.error('--reason required');
          return 1;
        }
        newOrch = State.planSpecGap(orch, { reason: opts.reason });
        applyOrchestration(story, newOrch);
        await writeStories(repo, stories, {
          kind: 'spec-plan-plan-spec-gap',
          storyId: opts.story,
          reason: opts.reason,
        });
        syncLegacySdlcPath(ctx, root);
        console.warn(
          `[agent-spec-plan] Spec gap reported by plan author. Spec phase reopened for ${opts.story}: ${opts.reason}`,
        );
        return 0;

      case 'plan-review-result':
        newOrch = State.planReviewResult(orch, { verdict: opts.verdict });
        applyOrchestration(story, newOrch);
        await writeStories(repo, stories, {
          kind: 'spec-plan-plan-review-result',
          storyId: opts.story,
          verdict: opts.verdict,
        });
        syncLegacySdlcPath(ctx, root);
        if (story.planPhase.state === 'escalated') {
          console.error(`[agent-spec-plan] Iteration cap reached for plan phase. Story escalated.`);
          return 1;
        }
        return 0;

      case 'plan-await-approval':
        newOrch = State.planAwaitApproval(orch);
        applyOrchestration(story, newOrch);
        await writeStories(repo, stories, {
          kind: 'spec-plan-plan-await-approval',
          storyId: opts.story,
        });
        syncLegacySdlcPath(ctx, root);
        return 2;

      case 'escalate':
        if (!opts.phase) {
          console.error('--phase required (spec|plan)');
          return 1;
        }
        if (opts.phase === 'spec') story.specPhase.state = 'escalated';
        else if (opts.phase === 'plan') story.planPhase.state = 'escalated';
        else {
          console.error(`Unknown phase '${opts.phase}'`);
          return 1;
        }
        await writeStories(repo, stories, {
          kind: 'spec-plan-escalate',
          storyId: opts.story,
          phase: opts.phase,
        });
        syncLegacySdlcPath(ctx, root);
        return 0;

      case 'show-pending': {
        const log = ctx.log || console.log;
        const pending = [];
        for (const [id, st] of Object.entries(stories)) {
          if (!st.specPhase) continue;
          if (st.specPhase.state === 'awaiting_ac_approval') pending.push({ id, gate: 'ac' });
          if (st.specPhase.state === 'awaiting_spec_approval') pending.push({ id, gate: 'spec' });
          if (st.planPhase && st.planPhase.state === 'awaiting_plan_approval') pending.push({ id, gate: 'plan' });
        }
        if (pending.length === 0) log('[agent-spec-plan] No pending approvals.');
        else pending.forEach((p) => log(`  ${p.id} — awaiting ${p.gate} approval`));
        return 0;
      }

      case 'list': {
        const log = ctx.log || console.log;
        const rows = [];
        for (const [id, st] of Object.entries(stories)) {
          if (!st.specPhase) continue;
          const overall = State.deriveOverall(st.specPhase.state, st.planPhase.state);
          if (!opts.state || overall === opts.state) {
            rows.push(`  ${id} — ${overall} (spec=${st.specPhase.state}, plan=${st.planPhase.state})`);
          }
        }
        if (rows.length === 0) log('[agent-spec-plan] No matching stories.');
        else rows.forEach((r) => log(r));
        return 0;
      }

      case 'apply-pending': {
        const dir = opts.dir || path.join(root, 'docs/pending-approvals');
        const flags = Flags.scanPendingDir(dir);
        for (const flag of flags) {
          if (!flag.ok) {
            console.warn(`[agent-spec-plan] Skipping malformed flag '${flag.name}': ${flag.reason}`);
            continue;
          }
          const p = flag.payload;
          const subOpts = { cmd: p.action, story: p.story, gate: p.gate, reason: p.reason };
          // Sub-dispatch reuses the same ctx so writes stay in the same root.
          const code = await dispatch(subOpts, ctx);
          if (code === 0) {
            try {
              fs.unlinkSync(flag.filePath);
            } catch (e) {
              console.warn(`[agent-spec-plan] Could not delete '${flag.name}': ${e.message}`);
            }
          } else {
            console.warn(
              `[agent-spec-plan] Skipping '${flag.name}': state transition failed (exit code ${code}). Flag left in place.`,
            );
          }
        }
        return 0;
      }

      default:
        console.error(`[agent-spec-plan] Unknown command '${cmd}'`);
        return 1;
    }
  } catch (e) {
    console.error(`[agent-spec-plan] ${e.message}`);
    return 1;
  } finally {
    Repository._reset();
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.cmd) {
    console.error('Usage: node tools/agent-spec-plan.js <command> [options]');
    return 1;
  }
  const code = await dispatch(opts);
  // Auto-regen the Agentic Dashboard after any state-mutating command.
  // Read-only commands (status/list/show-pending) skip this.
  if (!READ_ONLY_CMDS.has(opts.cmd)) regenDashboard();
  return code;
}

module.exports = { parseArgs, dispatch, main, SDLC_PATH };

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`[agent-spec-plan] fatal: ${e.message}`);
      process.exit(1);
    },
  );
}
