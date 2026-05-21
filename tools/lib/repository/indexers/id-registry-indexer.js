'use strict';
const fs = require('fs');
const { createTryInsert } = require('../insert-helper');

const ROW = /^\|\s*(\w+)\s*\|\s*([\w-]+)\s*\|\s*([\w-]+)\s*\|/;

function indexIdRegistry({ index, markdown, rel }) {
  if (!fs.existsSync(markdown.absolute(rel))) return { counts: { id_registry: 0 }, warnings: [] };
  const src = fs.readFileSync(markdown.absolute(rel), 'utf8');
  const warnings = [];
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM id_registry;');
    const ins = index.prepare('INSERT INTO id_registry(sequence,next_id,last_assigned) VALUES(?,?,?)');
    const tryInsert = createTryInsert({ warnings });
    for (const line of src.split('\n')) {
      const m = line.match(ROW);
      if (m && m[1] !== 'Sequence' && m[1] !== '------------') {
        if (tryInsert(() => ins.run(m[1], m[2], m[3]), m[1])) {
          count++;
        }
      }
    }
  });
  return { counts: { id_registry: count }, warnings };
}
module.exports = { indexIdRegistry };
