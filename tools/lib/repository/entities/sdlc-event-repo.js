'use strict';

/**
 * SdlcEventRepo — append-only log of SDLC lifecycle events.
 *
 * Each `record()` inserts a row into `sdlc_events` (autoincrement id, no PK
 * collision risk) and then asks the SdlcMirror to regenerate
 * `docs/sdlc-status.json` from SQL inside a file lock. The mirror is fully
 * re-rendered on every write rather than patched, which guarantees
 * byte-identical output across all four Phase D writers.
 */
class SdlcEventRepo {
  constructor({ index, mirror }) {
    this.index = index;
    this.mirror = mirror;
  }

  async record(event) {
    const ts = event.ts || Date.now();
    this.index
      .prepare('INSERT INTO sdlc_events(ts,kind,story_id,agent,payload_json) VALUES(?,?,?,?,?)')
      .run(ts, event.kind, event.storyId || null, event.agent || null, JSON.stringify(event));
    await this.mirror.write();
  }

  list({ storyId, since } = {}) {
    const where = [];
    const args = [];
    if (storyId) {
      where.push('story_id=?');
      args.push(storyId);
    }
    if (since) {
      where.push('ts >= ?');
      args.push(since);
    }
    const sql = `SELECT * FROM sdlc_events${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id`;
    return this.index.prepare(sql).all(...args);
  }
}

module.exports = { SdlcEventRepo };
