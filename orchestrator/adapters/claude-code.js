/**
 * Claude Code Adapter
 *
 * Spawning pattern for Anthropic's Claude Code CLI.
 * Uses the `claude` CLI with Agent tool for sub-agent spawning.
 *
 * Prerequisites:
 *   - Claude Code CLI installed: npm install -g @anthropic-ai/claude-code
 *   - Authenticated: claude login
 *
 * Docs: https://docs.anthropic.com/en/docs/claude-code
 */

module.exports = {
  name: 'Claude Code',
  cli: 'claude',

  /**
   * How to spawn a single agent from the terminal.
   */
  spawnCommand(agent) {
    return `claude "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`;
  },

  /**
   * How Conductor spawns a sub-agent within a session.
   * Claude Code uses the Agent tool natively — Conductor includes the
   * instruction file path and task in the Agent tool prompt.
   */
  conductorSpawnPattern(agent) {
    return [
      `Use the Agent tool to spawn a new agent:`,
      `  Prompt: "Read ${agent.instructionFile} for your full instructions.`,
      `           ${agent.task}"`,
    ].join('\n');
  },

  /**
   * How to spawn multiple agents in parallel.
   * Claude Code supports multiple Agent tool calls in a single message.
   */
  parallelSpawnPattern(agents) {
    return [
      `Use the Agent tool to spawn ${agents.length} agents in a single message:`,
      ...agents.map((a, i) =>
        [
          `  Agent ${i + 1}:`,
          `    Prompt: "Read ${a.instructionFile} for your full instructions.`,
          `             ${a.task}"`,
        ].join('\n'),
      ),
    ].join('\n');
  },

  /**
   * How to run parallel terminal sessions for maximum velocity.
   */
  parallelTerminals(agents) {
    return agents
      .map(
        (a, i) =>
          `# Terminal ${i + 1}: ${a.name}\nclaude "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
      )
      .join('\n\n');
  },

  /**
   * Platform-specific notes for the orchestration docs.
   */
  notes: [
    'Claude Code supports sub-agent spawning natively via the Agent tool.',
    'Parallel agents: include multiple Agent tool calls in a single response.',
    'Context window is managed automatically — prior messages compress as needed.',
    'File read/write/edit tools are built in.',
  ],
};
