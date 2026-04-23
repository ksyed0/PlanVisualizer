'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG_PATH = path.join(ROOT, 'agents.config.json');

describe('agents.config.json', () => {
  let config;

  beforeAll(() => {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  });

  it('exists and is valid JSON', () => {
    expect(config).toBeDefined();
    expect(config.agents).toBeDefined();
  });

  it('has at least one agent defined', () => {
    expect(Object.keys(config.agents).length).toBeGreaterThan(0);
  });

  it('each agent has required fields', () => {
    for (const [, agent] of Object.entries(config.agents)) {
      expect(agent.role).toBeTruthy();
      expect(agent.icon).toBeTruthy();
      // US-0137 AC-0498: colors must be valid CSS — either oklch() or legacy hex 6-digit
      expect(agent.color).toMatch(/^oklch\(|^#[0-9A-Fa-f]{6}$/);
      expect(agent.instructionFile).toBeTruthy();
    }
  });

  it('each agent instruction file exists', () => {
    for (const [, agent] of Object.entries(config.agents)) {
      const fullPath = path.join(ROOT, agent.instructionFile);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it('has orchestrator config', () => {
    expect(config.orchestrator).toBeDefined();
    expect(config.orchestrator.dmAgent).toBeTruthy();
    expect(config.orchestrator.reviewer).toBeTruthy();
  });

  it('dmAgent and reviewer reference valid agents', () => {
    expect(config.agents[config.orchestrator.dmAgent]).toBeDefined();
    expect(config.agents[config.orchestrator.reviewer]).toBeDefined();
  });

  it('avatarGrid references valid agents', () => {
    const grid = config.orchestrator.avatarGrid;
    if (grid) {
      const allGrid = [...(grid.topRow || []), ...(grid.bottomRow || [])];
      for (const name of allGrid) {
        expect(config.agents[name]).toBeDefined();
      }
    }
  });
});

describe('spawn.js config integration', () => {
  it('loads agents from config', () => {
    const { AGENTS, ORCHESTRATOR_CONFIG } = require('../../orchestrator/spawn.js');
    expect(Object.keys(AGENTS).length).toBeGreaterThan(0);
    expect(ORCHESTRATOR_CONFIG).toBeDefined();
  });

  it('getAgent returns config-driven agent', () => {
    const { getAgent } = require('../../orchestrator/spawn.js');
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const firstName = Object.keys(config.agents)[0];
    const agent = getAgent(firstName);
    expect(agent.name).toBe(firstName);
    expect(agent.role).toBe(config.agents[firstName].role);
    expect(agent.instructionFile).toBe(config.agents[firstName].instructionFile);
  });
});
