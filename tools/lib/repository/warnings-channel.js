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
    const out = [];
    const lines = fs.readFileSync(this.file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      try {
        out.push(JSON.parse(l));
      } catch (e) {
        console.warn(`[warnings-channel] skipping malformed line ${i + 1}: ${e.message}`);
      }
    }
    return out;
  }
}
module.exports = { WarningsChannel };
