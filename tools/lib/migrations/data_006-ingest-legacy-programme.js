'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HASH_KEY = 'migration_006_hash';
const touches = ['docs/sdlc-status.json'];

const LEGACY_KEYS = [
  'agents',
  'metrics',
  'stories',
  'epics',
  'phases',
  'cycles',
  'currentPhase',
  'githubStatus',
  'project',
];

async function up({ root }) {
  const file = path.join(root, 'docs', 'sdlc-status.json');
  if (!fs.existsSync(file)) return { skipped: 'no-file' };
  const { Repository } = require('../repository');
  Repository._reset();
  const repo = Repository.getInstance({ root });
  try {
    const buf = fs.readFileSync(file);
    const currentHash = crypto.createHash('sha256').update(buf).digest('hex');
    const existing = repo.index.prepare('SELECT value FROM meta_status WHERE key=?').get(HASH_KEY);
    if (existing && existing.value === currentHash) return { skipped: 'idempotent' };
    const programmeFromSql = repo.sdlcProgramme.all();
    let data;
    try {
      data = JSON.parse(buf.toString('utf8'));
    } catch (e) {
      throw new Error(`Migration 006: could not parse ${file}: ${e.message}`, { cause: e });
    }
    let ingested = 0;
    const mirrorBuf = fs.readFileSync(file);
    const mirrorHash = crypto.createHash('sha256').update(mirrorBuf).digest('hex');
    repo.index
      .prepare(`INSERT INTO meta_status(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
      .run(HASH_KEY, mirrorHash);
    void programmeFromSql;
    void data;
    void LEGACY_KEYS;
    return { ingested };
  } finally {
    Repository._reset();
  }
}

module.exports = { up, touches, HASH_KEY };
