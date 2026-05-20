'use strict';
const BUG_HEAD = /^BUG-(\d+):\s*(.+)$/m;
const KV = /^(\w[\w\s]*?):\s*(.+)$/;

function indexBugs({ index, markdown, rel }) {
  const ast = markdown.readAst(rel);
  const warnings = [];
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM bugs; DELETE FROM bug_stories;');
    const ins = index.prepare('INSERT INTO bugs(id,status,severity,source_file,source_line) VALUES(?,?,?,?,?)');
    let line = 1;
    for (const node of ast) {
      if (node.kind === 'prose') {
        line += (node.text.match(/\n/g) || []).length;
        continue;
      }
      const m = node.body.match(BUG_HEAD);
      if (m) {
        const id = `BUG-${m[1]}`;
        const kv = {};
        for (const ln of node.body.split('\n')) {
          const kvm = ln.match(KV);
          if (kvm) kv[kvm[1].trim()] = kvm[2].trim();
        }
        const status = kv.Status || 'Open';
        const severity = kv.Severity || null;
        try {
          ins.run(id, status, severity, rel, line);
          count++;
        } catch (e) {
          warnings.push({ code: 'invalid-status', entityId: id, value: status, message: e.message });
        }
      }
      line += (node.raw.match(/\n/g) || []).length;
    }
  });
  return { counts: { bugs: count }, warnings };
}
module.exports = { indexBugs };
