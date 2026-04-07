/**
 * OpenAI Codex CLI Adapter
 *
 * Spawning pattern for OpenAI's Codex CLI (open-source terminal agent).
 * Uses the `codex` CLI for agent execution.
 *
 * Prerequisites:
 *   - Codex CLI installed: npm install -g @openai/codex
 *   - OPENAI_API_KEY set in environment
 *
 * Docs: https://github.com/openai/codex
 */

module.exports = {
  name: 'OpenAI Codex CLI',
  cli: 'codex',

  /**
   * How to spawn a single agent from the terminal.
   */
  spawnCommand(agent) {
    return `codex "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`;
  },

  /**
   * How Conductor spawns a sub-agent within a session.
   * Codex CLI does not have native sub-agent spawning. Conductor must
   * use shell commands to launch parallel Codex sessions.
   */
  conductorSpawnPattern(agent) {
    return [
      `Run this shell command to spawn the agent:`,
      `  codex "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`,
      ``,
      `Note: Codex CLI does not support sub-agent spawning within a session.`,
      `Use separate terminal sessions for parallel agents.`,
    ].join('\n');
  },

  /**
   * How to spawn multiple agents in parallel.
   * Codex CLI requires separate terminal sessions.
   */
  parallelSpawnPattern(agents) {
    return [
      `Open ${agents.length} separate terminals and run each:`,
      ...agents.map((a, i) =>
        [
          `  Terminal ${i + 1} (${a.name}):`,
          `    codex "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
        ].join('\n'),
      ),
      ``,
      `Wait for all terminals to complete before proceeding.`,
    ].join('\n');
  },

  /**
   * How to run parallel terminal sessions for maximum velocity.
   */
  parallelTerminals(agents) {
    return agents
      .map(
        (a, i) =>
          `# Terminal ${i + 1}: ${a.name}\ncodex "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
      )
      .join('\n\n');
  },

  /**
   * Platform-specific notes for the orchestration docs.
   */
  notes: [
    'Codex CLI does not support sub-agent spawning — use separate terminals for parallel work.',
    'Set full_auto approval mode for autonomous execution: codex --approval-mode full-auto',
    'Codex supports file read/write/shell natively.',
    'For Conductor, run in a dedicated terminal and manually spawn sub-agents in other terminals.',
  ],
};
