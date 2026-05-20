'use strict';
const fs = require('fs');
const path = require('path');

class WarningsChannel {
  constructor({ root }) {
    this.file = path.join(root, '.cache', 'repo-warnings.jsonl');
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
  }
  append(violation) {
    const row = JSON.stringify({ ts: Date.now(), ...violation }) + '\n';
    fs.appendFileSync(this.file, row);
  }
  readAll() {
    if (!fs.existsSync(this.file)) return [];
    return fs
      .readFileSync(this.file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }
}
module.exports = { WarningsChannel };
