/**
 * CodeMie Adapter (EPAM)
 *
 * Spawning pattern for EPAM's CodeMie AI coding assistant.
 * CodeMie integrates with Claude and other LLM backends via EPAM DIAL.
 *
 * Prerequisites:
 *   - CodeMie CLI or IDE extension installed
 *   - EPAM DIAL API key configured
 *   - Model backend selected (defaults to Claude)
 *
 * Docs: https://codemie.epam.com
 */

module.exports = {
  name: 'CodeMie (EPAM)',
  cli: 'codemie',

  /**
   * How to spawn a single agent from the terminal.
   */
  spawnCommand(agent) {
    return `codemie chat --message "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`;
  },

  /**
   * How Conductor spawns a sub-agent within a session.
   * CodeMie runs as independent sessions — no native sub-agent spawning.
   */
  conductorSpawnPattern(agent) {
    return [
      `Run this shell command to spawn the agent:`,
      `  codemie chat --message "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`,
      ``,
      `Note: CodeMie runs as independent sessions via EPAM DIAL gateway.`,
      `Model routing is handled by the DIAL configuration.`,
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
          `    codemie chat --message "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
        ].join('\n'),
      ),
      ``,
      `All sessions route through EPAM DIAL for model selection and cost tracking.`,
    ].join('\n');
  },

  /**
   * How to run parallel terminal sessions.
   */
  parallelTerminals(agents) {
    return agents
      .map(
        (a, i) =>
          `# Terminal ${i + 1}: ${a.name}\ncodemie chat --message "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
      )
      .join('\n\n');
  },

  /**
   * Platform-specific notes.
   */
  notes: [
    "CodeMie is EPAM's AI coding assistant powered by EPAM DIAL.",
    'Supports multiple LLM backends (Claude, GPT, Gemini) via DIAL gateway routing.',
    'Cost tracking and usage analytics built in via DIAL.',
    'IDE extensions available for VS Code and JetBrains.',
    'Configure model backend via EPAM DIAL admin console or DIAL_MODEL env var.',
  ],
};
