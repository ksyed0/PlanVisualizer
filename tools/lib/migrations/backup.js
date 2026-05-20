// tools/lib/migrations/backup.js
'use strict';
const fs = require('fs');
const path = require('path');

function snapshot({ root, label, files }) {
  const dir = path.join(root, 'docs', '.pv-backup', label);
  fs.mkdirSync(dir, { recursive: true });
  for (const rel of files) {
    const src = path.join(root, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  return dir;
}

function listBackups({ root }) {
  const base = path.join(root, 'docs', '.pv-backup');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).sort();
}

function restore({ root, label }) {
  const dir = path.join(root, 'docs', '.pv-backup', label);
  if (!fs.existsSync(dir)) throw new Error(`backup not found: ${label}`);
  const restored = [];
  function walk(d, prefix) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const sub = path.join(d, entry.name);
      const relSub = path.join(prefix, entry.name);
      if (entry.isDirectory()) walk(sub, relSub);
      else {
        const dest = path.join(root, relSub);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(sub, dest);
        restored.push(relSub);
      }
    }
  }
  walk(dir, '');
  return restored;
}

module.exports = { snapshot, listBackups, restore };
