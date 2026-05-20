// tests/unit/repository/warnings-channel.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WarningsChannel } = require('../../../tools/lib/repository/warnings-channel');

test('append + readAll round-trip', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-'));
  const ch = new WarningsChannel({ root });
  ch.append({ code: 'orphan-ac', entityId: 'AC-0099' });
  ch.append({ code: 'id-registry-drift', sequence: 'AC' });
  const rows = ch.readAll();
  expect(rows.map((r) => r.code)).toEqual(['orphan-ac', 'id-registry-drift']);
  fs.rmSync(root, { recursive: true, force: true });
});
