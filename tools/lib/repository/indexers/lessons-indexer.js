'use strict';
const fs = require('fs');
const HEAD = /^L-(\d+):\s*(.+)$/m;
const AGENT_TAG = /@agent:(\w+)/g;

function indexLessons({ index, markdown, rel }) {
  if (!fs.existsSync(markdown.absolute(rel))) return { counts: {}, warnings: [] };
  const ast = markdown.readAst(rel);
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM lessons; DELETE FROM lesson_agents;');
    const insL = index.prepare('INSERT INTO lessons(id,text,source_file,source_line) VALUES(?,?,?,?)');
    const insA = index.prepare('INSERT INTO lesson_agents(lesson_id,agent_name) VALUES(?,?)');
    let line = 1;
    for (const node of ast) {
      if (node.kind === 'prose') {
        line += (node.text.match(/\n/g) || []).length;
        continue;
      }
      const m = node.body.match(HEAD);
      if (m) {
        const id = `L-${m[1]}`;
        insL.run(id, node.body, rel, line);
        count++;
        const agents = new Set();
        let tagMatch;
        AGENT_TAG.lastIndex = 0;
        while ((tagMatch = AGENT_TAG.exec(node.body)) !== null) agents.add(tagMatch[1]);
        for (const a of agents) insA.run(id, a);
      }
      line += (node.raw.match(/\n/g) || []).length;
    }
  });
  return { counts: { lessons: count }, warnings: [] };
}
module.exports = { indexLessons };
