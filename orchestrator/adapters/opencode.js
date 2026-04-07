/**
 * OpenCode Adapter
 *
 * Spawning pattern for OpenCode, the open-source terminal AI coding assistant.
 * Supports multiple model backends: Gemma, Qwen, MiniMax, Kimi, and others.
 *
 * Prerequisites:
 *   - OpenCode installed: go install github.com/opencode-ai/opencode@latest
 *   - Model configured via OPENCODE_MODEL env var or --model flag
 *   - API key for chosen provider (or Ollama for local models)
 *
 * Supported models (via --model flag):
 *   - gemma    — Google Gemma (via Google AI or Ollama)
 *   - qwen     — Alibaba Qwen (via Dashscope or Ollama)
 *   - minimax  — MiniMax (via MiniMax API)
 *   - kimi     — Moonshot Kimi (via Moonshot API)
 *   - Any OpenAI-compatible endpoint via OPENCODE_API_BASE
 *
 * Docs: https://github.com/opencode-ai/opencode
 */

module.exports = {
  name: 'OpenCode',
  cli: 'opencode',

  /**
   * How to spawn a single agent from the terminal.
   */
  spawnCommand(agent) {
    return `opencode --message "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`;
  },

  /**
   * How Conductor spawns a sub-agent within a session.
   * OpenCode runs as independent sessions.
   */
  conductorSpawnPattern(agent) {
    return [
      `Run this shell command to spawn the agent:`,
      `  opencode --message "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`,
      ``,
      `Note: OpenCode runs as independent sessions.`,
      `Set model via: OPENCODE_MODEL=qwen opencode --message "..."`,
      `Supported models: gemma, qwen, minimax, kimi, or any OpenAI-compatible endpoint.`,
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
          `    opencode --message "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
        ].join('\n'),
      ),
      ``,
      `Set OPENCODE_MODEL env var to choose backend (gemma, qwen, minimax, kimi).`,
    ].join('\n');
  },

  /**
   * How to run parallel terminal sessions.
   */
  parallelTerminals(agents) {
    return agents
      .map(
        (a, i) =>
          `# Terminal ${i + 1}: ${a.name}\nopencode --message "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
      )
      .join('\n\n');
  },

  /**
   * Platform-specific notes.
   */
  notes: [
    'OpenCode supports multiple LLM backends via --model or OPENCODE_MODEL env var.',
    'Supported models: gemma (Google), qwen (Alibaba), minimax (MiniMax), kimi (Moonshot).',
    'For local models: use Ollama backend with OPENCODE_API_BASE=http://localhost:11434.',
    'For Qwen: set DASHSCOPE_API_KEY. For Kimi: set MOONSHOT_API_KEY. For MiniMax: set MINIMAX_API_KEY.',
    'OpenCode auto-commits changes to git — configure with --no-auto-commit if needed.',
  ],
};
