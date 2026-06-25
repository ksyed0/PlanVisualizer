// tests/e2e/helpers/index.js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');

function createTempProject({ skipGitInit = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-e2e-'));
  if (!skipGitInit) {
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@pv-e2e.local"', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.name "PV E2E"', { cwd: dir, stdio: 'pipe' });
    execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });
  }
  return {
    dir,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function runScript(script, args = [], cwd, { timeout = 120000 } = {}) {
  // Shell scripts (scripts/*.sh): resolve relative to PV root
  const isShellScript = script.endsWith('.sh') || script.startsWith('scripts/');
  let fullCmd;
  if (isShellScript) {
    const scriptPath = path.isAbsolute(script) ? script : path.join(ROOT, script);
    const quotedArgs = args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ');
    fullCmd = `bash "${scriptPath}" ${quotedArgs}`.trim();
  } else {
    // npm, node, or inline shell command
    const quotedArgs = args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ');
    fullCmd = args.length ? `${script} ${quotedArgs}` : script;
  }
  try {
    return execSync(fullCmd, {
      cwd: cwd || ROOT,
      timeout,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (err) {
    throw new Error(
      [
        `Command failed: ${fullCmd}`,
        `Exit code: ${err.status ?? 'unknown'}`,
        `stdout: ${err.stdout || ''}`,
        `stderr: ${err.stderr || ''}`,
      ].join('\n'),
      { cause: err },
    );
  }
}

function assertHtml(htmlPath, { contains = [], excludes = [] } = {}) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  for (const str of contains) {
    expect(html).toContain(str);
  }
  for (const str of excludes) {
    expect(html).not.toContain(str);
  }
}

function assertSdlcState(sdlcPath, shape) {
  const json = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  for (const [key, expected] of Object.entries(shape)) {
    if (typeof expected === 'object' && expected !== null) {
      expect(json[key]).toMatchObject(expected);
    } else {
      expect(json[key]).toBe(expected);
    }
  }
}

async function waitForPR(branchName, timeoutMs = 1800000, intervalMs = 30000) {
  const token = process.env.E2E_GITHUB_TOKEN;
  if (!token) throw new Error('E2E_GITHUB_TOKEN not set');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const out = execSync(`gh pr list --head "${branchName}" --json number`, {
        encoding: 'utf8',
        env: { ...process.env, GH_TOKEN: token },
        stdio: 'pipe',
      });
      const prs = JSON.parse(out);
      if (prs.length > 0) return prs[0].number;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`No PR for branch "${branchName}" after ${timeoutMs}ms`);
}

module.exports = { createTempProject, runScript, assertHtml, assertSdlcState, waitForPR };
