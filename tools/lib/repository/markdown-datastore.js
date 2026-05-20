'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseMarkdown } = require('./ast/parser');
const { serializeAst } = require('./ast/serializer');
const { withFileLock } = require('./file-lock');

class MarkdownDatastore {
  constructor({ root }) {
    this.root = root;
  }
  absolute(rel) {
    return path.join(this.root, rel);
  }

  readAst(rel) {
    const src = fs.readFileSync(this.absolute(rel), 'utf8');
    return parseMarkdown(src);
  }

  sourceMeta(rel) {
    const abs = this.absolute(rel);
    const st = fs.statSync(abs);
    const buf = fs.readFileSync(abs);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    return { mtime: Math.floor(st.mtimeMs), size: st.size, hash };
  }

  async writeAst(rel, ast) {
    const abs = this.absolute(rel);
    await withFileLock(abs, async () => {
      const out = serializeAst(ast);
      const tmp = abs + '.tmp';
      fs.writeFileSync(tmp, out);
      fs.renameSync(tmp, abs);
    });
  }
}

module.exports = { MarkdownDatastore };
