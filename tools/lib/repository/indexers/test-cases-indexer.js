'use strict';
const HEAD = /^TC-(\d+)\s+\(US-(\d+)\):\s*(.+)$/m;
const KV = /^(\w[\w\s]*?):\s*(.+)$/;

function indexTestCases({ index, markdown, rel }) {
  const ast = markdown.readAst(rel);
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM test_cases;');
    const ins = index.prepare('INSERT INTO test_cases(id,story_id,title,status) VALUES(?,?,?,?)');
    for (const node of ast) {
      if (node.kind !== 'fenced') continue;
      const m = node.body.match(HEAD);
      if (m) {
        const id = `TC-${m[1]}`;
        const kv = {};
        for (const ln of node.body.split('\n')) {
          const kvm = ln.match(KV);
          if (kvm) kv[kvm[1].trim()] = kvm[2].trim();
        }
        ins.run(id, `US-${m[2]}`, m[3], kv.Status || null);
        count++;
      }
    }
  });
  return { counts: { test_cases: count }, warnings: [] };
}
module.exports = { indexTestCases };
