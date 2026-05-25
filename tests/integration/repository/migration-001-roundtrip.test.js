'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { Repository } = require('../../../tools/lib/repository');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0243-mig001-int-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

async function runUpgrade(root) {
  // Import pv-upgrade and invoke main() with the --root flag.
  const upgradeModule = require('../../../tools/pv-upgrade');
  let outputLines = [];
  const mockStdout = (s) => outputLines.push(s);
  try {
    const exitCode = await upgradeModule.main({
      argv: ['--root', root],
      stdout: mockStdout,
    });
    return {
      exitCode,
      output: outputLines.join('\n'),
    };
  } catch (err) {
    return {
      exitCode: 1,
      error: err.message,
      output: outputLines.join('\n'),
    };
  }
}

describe('US-0243: Migration 001 via pv:upgrade', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('applies migration on first upgrade, no-op on second', async () => {
    root = mkRoot();
    // Seed with a NON-canonical RELEASE_PLAN.md (fenced block).
    // Migration 001 normalises the fence format.
    fs.writeFileSync(
      path.join(root, 'docs', 'RELEASE_PLAN.md'),
      `# Plan\n\n\n\`\`\`\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n\`\`\`\n\n\n`,
    );

    if (Repository._reset) Repository._reset();
    const up1 = await runUpgrade(root);
    // The upgrade should succeed.
    expect(up1.exitCode).toBe(0);
    expect(up1.output).toContain('applied data_001-');

    const afterFirst = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');

    // Second invocation: must be a no-op (migration is now in appliedMigrations).
    if (Repository._reset) Repository._reset();
    const up2 = await runUpgrade(root);
    expect(up2.exitCode).toBe(0);
    // Should see the no-op message
    expect(up2.output).toContain('no-op');

    // The file content must be byte-identical to what the first run produced.
    expect(fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8')).toBe(afterFirst);
  });
});
