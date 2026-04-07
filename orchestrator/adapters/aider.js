/**
 * Aider Adapter (Open-Source)
 *
 * Spawning pattern for Aider, the open-source AI pair programming tool.
 * Works with any model backend (OpenAI, Anthropic, Ollama, local models).
 *
 * Prerequisites:
 *   - Aider installed: pip install aider-chat
 *   - Model configured via --model flag or AIDER_MODEL env var
 *   - API key for chosen provider (or Ollama for local models)
 *
 * Docs: https://aider.chat
 */

module.exports = {
  name: 'Aider (Open-Source)',
  cli: 'aider',

  /**
   * How to spawn a single agent from the terminal.
   * Aider uses --message for non-interactive mode.
   */
  spawnCommand(agent) {
    return `aider --message "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`;
  },

  /**
   * How Conductor spawns a sub-agent within a session.
   * Aider does not support sub-agent spawning. Each agent runs
   * as an independent Aider session.
   */
  conductorSpawnPattern(agent) {
    return [
      `Run this shell command to spawn the agent:`,
      `  aider --message "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`,
      ``,
      `Note: Aider runs as independent sessions. Use --yes-always for autonomous mode.`,
      `For specific model: aider --model ollama/llama3 --message "..."`,
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
          `    aider --message "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
        ].join('\n'),
      ),
      ``,
      `Use --yes-always for autonomous mode. Wait for all to complete.`,
    ].join('\n');
  },

  /**
   * How to run parallel terminal sessions for maximum velocity.
   */
  parallelTerminals(agents) {
    return agents
      .map(
        (a, i) =>
          `# Terminal ${i + 1}: ${a.name}\naider --yes-always --message "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
      )
      .join('\n\n');
  },

  /**
   * Platform-specific notes for the orchestration docs.
   */
  notes: [
    'Aider works with any LLM: OpenAI, Anthropic, Ollama (local), Azure, etc.',
    'Use --model to specify: --model ollama/llama3, --model claude-3-5-sonnet, --model gpt-4o',
    'Use --yes-always for fully autonomous operation (no confirmation prompts).',
    'Aider auto-commits changes to git — configure with --no-auto-commits if needed.',
    'For local models: install Ollama, pull a model, then use --model ollama/<model-name>.',
  ],
};
