/**
 * Google Gemini CLI Adapter
 *
 * Spawning pattern for Google's Gemini CLI agent.
 * Uses the `gemini` CLI for agent execution.
 *
 * Prerequisites:
 *   - Gemini CLI installed: npm install -g @anthropic-ai/gemini (placeholder)
 *   - GOOGLE_API_KEY or gcloud auth configured
 *
 * Docs: https://github.com/google-gemini/gemini-cli
 */

module.exports = {
  name: 'Google Gemini CLI',
  cli: 'gemini',

  /**
   * How to spawn a single agent from the terminal.
   */
  spawnCommand(agent) {
    return `gemini "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`;
  },

  /**
   * How Conductor spawns a sub-agent within a session.
   * Gemini CLI supports sandbox tool execution. Sub-agent spawning
   * is done via shell commands within the session.
   */
  conductorSpawnPattern(agent) {
    return [
      `Run this shell command to spawn the agent:`,
      `  gemini "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`,
      ``,
      `Note: Use separate terminal sessions for parallel agents.`,
    ].join('\n');
  },

  /**
   * How to spawn multiple agents in parallel.
   */
  parallelSpawnPattern(agents) {
    return [
      `Open ${agents.length} separate terminals and run each:`,
      ...agents.map((a, i) =>
        [
          `  Terminal ${i + 1} (${a.name}):`,
          `    gemini "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
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
          `# Terminal ${i + 1}: ${a.name}\ngemini "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
      )
      .join('\n\n');
  },

  /**
   * Platform-specific notes for the orchestration docs.
   */
  notes: [
    'Gemini CLI supports file operations and shell commands natively.',
    'For parallel agents, use separate terminal sessions.',
    'Gemini supports function calling — agent instruction files work as system prompts.',
    'Use Gemini 2.5 Pro for best code generation results.',
  ],
};
