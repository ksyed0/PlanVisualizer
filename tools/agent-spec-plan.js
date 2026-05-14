#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const State = require('./lib/agent-spec-plan-state');
const Flags = require('./lib/agent-spec-plan-flags');

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

function readSdlc(sdlcPath) {
  return JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
}

function writeSdlc(sdlcPath, data) {
  fs.writeFileSync(sdlcPath, JSON.stringify(data, null, 2) + '\n');
}

function ensureStory(data, storyId) {
  if (!data.stories) data.stories = {};
  const story = data.stories[storyId];
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

function dispatch(opts, ctx = {}) {
  const sdlcPath = ctx.sdlcPath || SDLC_PATH;
  let data;
  try {
    data = readSdlc(sdlcPath);
  } catch (e) {
    console.error(`[agent-spec-plan] Cannot read ${sdlcPath}: ${e.message}`);
    return 1;
  }

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

  try {
    let story, orch, newOrch;
    if (storyCmds.has(cmd)) {
      story = ensureStory(data, opts.story);
      ensureOrchestration(story);
      orch = getOrchestration(story);
    }

    switch (cmd) {
      case 'spec-start':
        newOrch = State.specStart(orch, { uiSurface: opts.uiSurface === 'true' });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        return 0;

      case 'spec-update':
        if (!opts.field) {
          console.error('--field required');
          return 1;
        }
        newOrch = State.specUpdate(orch, { field: opts.field, value: opts.value });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        return 0;

      case 'spec-await-ac':
        newOrch = State.specAwaitAc(orch);
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        return 2;

      case 'spec-review-result':
        newOrch = State.specReviewResult(orch, { verdict: opts.verdict });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
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
        writeSdlc(sdlcPath, data);
        return 2;

      case 'approve':
        if (!opts.gate) {
          console.error('--gate required');
          return 1;
        }
        if (opts.gate === 'ac') newOrch = State.acApprove(orch);
        else if (opts.gate === 'spec') newOrch = State.specApprove(orch);
        else if (opts.gate === 'plan') newOrch = State.planApprove(orch);
        else {
          console.error(`Unknown gate '${opts.gate}'`);
          return 1;
        }
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        console.log(`[agent-spec-plan] Approved ${opts.gate} gate for ${opts.story}.`);
        return 0;

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
        writeSdlc(sdlcPath, data);
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
        writeSdlc(sdlcPath, data);
        return 0;

      case 'plan-update':
        if (!opts.field) {
          console.error('--field required');
          return 1;
        }
        newOrch = State.planUpdate(orch, { field: opts.field, value: opts.value });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        return 0;

      case 'plan-spec-gap':
        if (!opts.reason) {
          console.error('--reason required');
          return 1;
        }
        newOrch = State.planSpecGap(orch, { reason: opts.reason });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        console.warn(
          `[agent-spec-plan] Spec gap reported by plan author. Spec phase reopened for ${opts.story}: ${opts.reason}`,
        );
        return 0;

      case 'plan-review-result':
        newOrch = State.planReviewResult(orch, { verdict: opts.verdict });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        if (story.planPhase.state === 'escalated') {
          console.error(`[agent-spec-plan] Iteration cap reached for plan phase. Story escalated.`);
          return 1;
        }
        return 0;

      case 'plan-await-approval':
        newOrch = State.planAwaitApproval(orch);
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
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
        writeSdlc(sdlcPath, data);
        return 0;

      case 'show-pending': {
        const log = ctx.log || console.log;
        const stories = data.stories || {};
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
        const stories = data.stories || {};
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
        const dir = opts.dir || path.join(ROOT, 'docs/pending-approvals');
        const flags = Flags.scanPendingDir(dir);
        for (const flag of flags) {
          if (!flag.ok) {
            console.warn(`[agent-spec-plan] Skipping malformed flag '${flag.name}': ${flag.reason}`);
            continue;
          }
          const p = flag.payload;
          const subOpts = { cmd: p.action, story: p.story, gate: p.gate, reason: p.reason };
          const code = dispatch(subOpts, { sdlcPath });
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
  }
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.cmd) {
    console.error('Usage: node tools/agent-spec-plan.js <command> [options]');
    return 1;
  }
  const code = dispatch(opts);
  // Auto-regen the Agentic Dashboard after any state-mutating command.
  // Read-only commands (status/list/show-pending) skip this.
  if (!READ_ONLY_CMDS.has(opts.cmd)) regenDashboard();
  return code;
}

module.exports = { parseArgs, dispatch, main };

if (require.main === module) {
  process.exit(main());
}
