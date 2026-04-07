/**
 * EliteA Adapter (EPAM)
 *
 * Spawning pattern for EPAM's EliteA AI platform.
 * EliteA provides enterprise-grade AI agent orchestration with
 * prompt management, model routing, and governance controls.
 *
 * Prerequisites:
 *   - EliteA CLI installed or API access configured
 *   - EPAM DIAL API key or EliteA workspace credentials
 *   - Agent prompts registered in EliteA prompt library (optional)
 *
 * Docs: https://elitea.epam.com
 */

module.exports = {
  name: 'EliteA (EPAM)',
  cli: 'elitea',

  /**
   * How to spawn a single agent from the terminal.
   */
  spawnCommand(agent) {
    return `elitea run --prompt "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`;
  },

  /**
   * How Conductor spawns a sub-agent within a session.
   * EliteA supports prompt chaining — Conductor can invoke
   * registered prompts by name or pass inline instructions.
   */
  conductorSpawnPattern(agent) {
    return [
      `Run this shell command to spawn the agent:`,
      `  elitea run --prompt "Read ${agent.instructionFile} for your full instructions. ${agent.task}"`,
      ``,
      `Or use a registered prompt from the EliteA library:`,
      `  elitea run --prompt-name "sdlc-${agent.name.toLowerCase()}" --vars "task=${agent.task}"`,
      ``,
      `Note: EliteA routes through EPAM DIAL for model selection and governance.`,
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
          `    elitea run --prompt "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
        ].join('\n'),
      ),
      ``,
      `EliteA supports prompt chaining — registered prompts can reference each other.`,
      `All executions are tracked in the EliteA audit log for governance.`,
    ].join('\n');
  },

  /**
   * How to run parallel terminal sessions.
   */
  parallelTerminals(agents) {
    return agents
      .map(
        (a, i) =>
          `# Terminal ${i + 1}: ${a.name}\nelitea run --prompt "Read ${a.instructionFile} for your full instructions. ${a.task}"`,
      )
      .join('\n\n');
  },

  /**
   * Platform-specific notes.
   */
  notes: [
    "EliteA is EPAM's enterprise AI platform with prompt management and governance.",
    'Supports prompt library — register reusable agent prompts by name.',
    'Model routing via EPAM DIAL gateway (Claude, GPT, Gemini, open-source).',
    'Built-in audit logging, cost tracking, and access controls.',
    'Prompt chaining allows Conductor to orchestrate sub-agents via registered prompts.',
    'Configure workspace via ELITEA_WORKSPACE and ELITEA_API_KEY env vars.',
  ],
};
