'use strict';

/**
 * US-0244 / AC-0955: tools/agent-context.js must not have any direct
 * fs.write / fs.append to managed paths. Allowed:
 *   - writes to /tmp/* (debug output)
 *   - writes where the resolved path is in the AGENT_CONTEXT_EXEMPT list
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'tools', 'agent-context.js');

describe('US-0244 / AC-0955: agent-context.js managed-path write gate', () => {
  const source = fs.readFileSync(FILE, 'utf8');

  it('no fs.writeFileSync or fs.appendFileSync targets a managed path', () => {
    const re = /fs\.(writeFileSync|appendFileSync)\s*\(\s*([^,)\s]+)/g;
    const hits = [];
    let m;
    while ((m = re.exec(source)) !== null) {
      const arg = m[2];
      // Exempt-by-name heuristic: any of /tmp/, or a variable name containing
      // tmp/debug/log/cache/out (case-insensitive).
      const exemptByName = /(?:^|[._/])(tmp|debug|log|cache|out)/i.test(arg) || /\/tmp\//.test(arg);
      if (!exemptByName) {
        hits.push({ line: source.slice(0, m.index).split('\n').length, call: m[0] });
      }
    }
    if (hits.length > 0) {
      throw new Error(
        `agent-context.js still contains ${hits.length} non-exempt fs.write call(s):\n` +
          hits.map((h) => `  L${h.line}: ${h.call}`).join('\n'),
      );
    }
  });

  it('does not import "parse-release-plan" / "parse-bugs" / "parse-lessons" for write purposes', () => {
    expect(source).not.toMatch(/require\(['"][^'"]*parse-release-plan['"]\)/);
    expect(source).not.toMatch(/require\(['"][^'"]*parse-bugs['"]\)/);
    expect(source).not.toMatch(/require\(['"][^'"]*parse-lessons['"]\)/);
  });
});
