/**
 * spawn.js — Platform-Agnostic Agent Spawning
 *
 * Provides a unified interface for spawning SDLC agents across different
 * agentic platforms. Reads ORCHESTRATOR_PLATFORM env var to select adapter.
 *
 * Supported platforms:
 *   - claude-code  (default) — Anthropic Claude Code CLI
 *   - codex        — OpenAI Codex CLI
 *   - gemini       — Google Gemini CLI
 *   - aider        — Open-source Aider (any model backend)
 *   - codemie      — EPAM CodeMie (Claude via DIAL)
 *   - opencode     — OpenCode (Gemma, Qwen, MiniMax, Kimi)
 *   - elitea       — EPAM EliteA (enterprise AI platform)
 *
 * Usage:
 *   ORCHESTRATOR_PLATFORM=codex node orchestrator/spawn.js --agent Forge --task "Implement services"
 *   node orchestrator/spawn.js --list-platforms
 *   node orchestrator/spawn.js --agent Conductor
 */

// --- Agent Registry (loaded from agents.config.json) ---
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadAgentsConfig() {
  const cfgPath = path.join(ROOT, 'agents.config.json');
  if (!fs.existsSync(cfgPath)) {
    console.error('[spawn] agents.config.json not found. Create one with agent definitions.');
    process.exit(1);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (err) {
    console.error(`[spawn] Failed to parse agents.config.json: ${err.message}`);
    process.exit(1);
  }
  const agents = {};
  for (const [name, cfg] of Object.entries(raw.agents)) {
    agents[name] = {
      instructionFile: cfg.instructionFile,
      icon: cfg.icon,
      role: cfg.role,
    };
  }
  return { agents, orchestrator: raw.orchestrator || {} };
}

const { agents: AGENTS, orchestrator: ORCHESTRATOR_CONFIG } = loadAgentsConfig();

// --- Platform Adapters ---
const ADAPTERS = {
  'claude-code': require('./adapters/claude-code'),
  codex: require('./adapters/codex-cli'),
  gemini: require('./adapters/gemini-cli'),
  aider: require('./adapters/aider'),
  codemie: require('./adapters/codemie'),
  opencode: require('./adapters/opencode'),
  elitea: require('./adapters/elitea'),
};

const DEFAULT_PLATFORM = 'claude-code';

/**
 * Check if a CLI tool is available on the system PATH.
 */
function cliExists(cli) {
  const { execSync } = require('child_process');
  try {
    execSync(`which ${cli} 2>/dev/null`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the active adapter based on ORCHESTRATOR_PLATFORM env var.
 * Falls back to Claude Code if the requested platform's CLI is not installed.
 * Caches result to avoid duplicate fallback warnings.
 */
let _cachedAdapter = null;
function getAdapter() {
  if (_cachedAdapter) return _cachedAdapter;
  const requested = process.env.ORCHESTRATOR_PLATFORM || DEFAULT_PLATFORM;
  const adapter = ADAPTERS[requested];
  if (!adapter) {
    console.error(`Unknown platform: "${requested}". Available: ${Object.keys(ADAPTERS).join(', ')}`);
    process.exit(1);
  }

  // If the requested platform's CLI isn't installed, fall back to Claude Code
  if (requested !== DEFAULT_PLATFORM && !cliExists(adapter.cli)) {
    const fallback = ADAPTERS[DEFAULT_PLATFORM];
    console.warn(`[orchestrator] "${adapter.cli}" not found on PATH — falling back to ${fallback.name}`);
    _cachedAdapter = fallback;
    return fallback;
  }

  _cachedAdapter = adapter;
  return adapter;
}

/**
 * Get an agent config by name.
 */
function getAgent(name) {
  const agent = AGENTS[name];
  if (!agent) {
    console.error(`Unknown agent: "${name}". Available: ${Object.keys(AGENTS).join(', ')}`);
    process.exit(1);
  }
  return { name, ...agent };
}

/**
 * Generate the spawn command for an agent on the active platform.
 */
function spawnCommand(agentName, task) {
  const adapter = getAdapter();
  const agent = getAgent(agentName);
  if (task) agent.task = task;
  else agent.task = `You are ${agentName}, the ${agent.role}. Follow your instruction file completely.`;
  return adapter.spawnCommand(agent);
}

/**
 * Generate Conductor's spawn pattern for a sub-agent.
 */
function conductorSpawn(agentName, task) {
  const adapter = getAdapter();
  const agent = getAgent(agentName);
  agent.task = task || `Follow your instruction file.`;
  return adapter.conductorSpawnPattern(agent);
}

/**
 * Generate parallel spawn commands for multiple agents.
 */
function parallelSpawn(agentConfigs) {
  const adapter = getAdapter();
  const agents = agentConfigs.map((a) => ({
    ...getAgent(a.name),
    task: a.task || `Follow your instruction file.`,
  }));
  return adapter.parallelSpawnPattern(agents);
}

// --- CLI ---
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list-platforms')) {
    console.log('Available platforms:');
    Object.entries(ADAPTERS).forEach(([key, adapter]) => {
      const active = key === (process.env.ORCHESTRATOR_PLATFORM || DEFAULT_PLATFORM) ? ' (active)' : '';
      console.log(`  ${key} — ${adapter.name}${active}`);
    });
    console.log(`\nSet ORCHESTRATOR_PLATFORM env var to switch. Default: ${DEFAULT_PLATFORM}`);
    return;
  }

  if (args.includes('--list-agents')) {
    console.log('Available agents:');
    Object.entries(AGENTS).forEach(([name, agent]) => {
      console.log(`  ${agent.icon} ${name} — ${agent.role} (${agent.instructionFile})`);
    });
    return;
  }

  if (args.includes('--print-all')) {
    const adapter = getAdapter();
    console.log(`Platform: ${adapter.name} (${adapter.cli})\n`);
    const dmAgent = ORCHESTRATOR_CONFIG.dmAgent || Object.keys(AGENTS)[0];
    console.log(`=== Quick Start: Launch ${dmAgent} ===\n`);
    console.log(spawnCommand(dmAgent));
    console.log('\n=== All Agent Spawn Commands ===\n');
    Object.keys(AGENTS).forEach((name) => {
      console.log(`# ${name}`);
      console.log(spawnCommand(name));
      console.log('');
    });
    console.log('=== Parallel Sessions (Maximum Velocity) ===\n');
    console.log(
      adapter.parallelTerminals([
        {
          ...getAgent('Keystone'),
          task: 'Scaffold the project, then implement all services.',
        },
        {
          ...getAgent('Pixel'),
          task: 'Set up the theme, then build all screens and components.',
        },
        { ...getAgent('Sentinel'), task: 'Execute all test cases.' },
      ]),
    );
    console.log('\n=== Platform Notes ===\n');
    adapter.notes.forEach((n) => console.log(`  • ${n}`));
    return;
  }

  const agentIdx = args.indexOf('--agent');
  if (agentIdx === -1) {
    console.log('Usage:');
    console.log('  node orchestrator/spawn.js --list-platforms');
    console.log('  node orchestrator/spawn.js --list-agents');
    console.log('  node orchestrator/spawn.js --print-all');
    console.log('  node orchestrator/spawn.js --agent <AgentName> [--task "description"]');
    console.log('  ORCHESTRATOR_PLATFORM=codex node orchestrator/spawn.js --agent Forge');
    return;
  }

  if (agentIdx + 1 >= args.length) {
    console.error('Error: --agent requires an argument');
    console.log('Usage: node orchestrator/spawn.js --agent <AgentName> [--task "description"]');
    process.exit(1);
  }
  const agentName = args[agentIdx + 1];
  const taskIdx = args.indexOf('--task');
  if (taskIdx !== -1 && taskIdx + 1 >= args.length) {
    console.error('Error: --task requires an argument');
    process.exit(1);
  }
  const task = taskIdx !== -1 ? args[taskIdx + 1] : null;

  const cmd = spawnCommand(agentName, task);
  const adapter = getAdapter();

  console.log(`Platform: ${adapter.name}`);
  console.log(`Agent: ${agentName}`);
  console.log(`Command:\n\n  ${cmd}\n`);
}

// Export for programmatic use
module.exports = {
  spawnCommand,
  conductorSpawn,
  parallelSpawn,
  getAdapter,
  getAgent,
  loadAgentsConfig,
  AGENTS,
  ADAPTERS,
  ORCHESTRATOR_CONFIG,
};

if (require.main === module) {
  main();
}
