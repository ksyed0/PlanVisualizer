// tests/unit/agent-files.test.js
'use strict';
const fs = require('fs');
const path = require('path');

const SPECIALIST_AGENTS = [
  'PO_AGENT.md',
  'ARCHITECT_AGENT.md',
  'UI_DESIGNER_AGENT.md',
  'FE_DEV_AGENT.md',
  'BE_DEV_AGENT.md',
  'CODE_REVIEWER_AGENT.md',
  'FUNCTIONAL_TESTER_AGENT.md',
  'AUTOMATION_TESTER_AGENT.md',
];

const AGENTS_DIR = path.join(__dirname, '..', '..', 'docs', 'agents');

function readAgentFile(name) {
  return fs.readFileSync(path.join(AGENTS_DIR, name), 'utf8');
}

function findModelSelectionTable(content) {
  const re = /## Model Selection\n+([^\n]+)\n([^\n]+)\n([\s\S]*?)(?=\n## |$)/m;
  const m = content.match(re);
  if (!m) return null;
  return { headerLine: m[1], separatorLine: m[2], body: m[3] };
}

function parseTableRows(body) {
  return body
    .split('\n')
    .filter((l) => l.trim().startsWith('|') && !l.match(/^\|\s*-+\s*\|/))
    .map((l) =>
      l
        .split('|')
        .map((s) => s.trim())
        .filter((s) => s !== ''),
    );
}

describe('agent-files — Model Selection contract', () => {
  test('all 8 specialist agent files contain a `## Model Selection` section', () => {
    for (const file of SPECIALIST_AGENTS) {
      const content = readAgentFile(file);
      const table = findModelSelectionTable(content);
      expect(table).not.toBeNull();
    }
  });

  test('each Model Selection table has exact column headers [Task type, Model, Rationale]', () => {
    for (const file of SPECIALIST_AGENTS) {
      const content = readAgentFile(file);
      const table = findModelSelectionTable(content);
      expect(table.headerLine).toMatch(/\|\s*Task type\s*\|\s*Model\s*\|\s*Rationale\s*\|/);
    }
  });

  test('opus row count across all 8 agent files is ≤ 20% of total rows', () => {
    let totalRows = 0;
    let opusRows = 0;
    for (const file of SPECIALIST_AGENTS) {
      const content = readAgentFile(file);
      const table = findModelSelectionTable(content);
      const rows = parseTableRows(table.body);
      totalRows += rows.length;
      opusRows += rows.filter((r) => r[1] === 'opus').length;
    }
    const ratio = opusRows / totalRows;
    expect(ratio).toBeLessThanOrEqual(0.2);
  });

  test('DM_AGENT.md does NOT contain a `## Model Selection` section', () => {
    const content = readAgentFile('DM_AGENT.md');
    expect(content).not.toMatch(/^## Model Selection$/m);
  });
});
