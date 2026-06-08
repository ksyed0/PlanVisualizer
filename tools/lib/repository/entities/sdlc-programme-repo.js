'use strict';

/**
 * SdlcProgrammeRepo — key/value JSON store for programme-wide SDLC state.
 *
 * Each `set(key, value)` upserts a JSON-serialized value and triggers a JSON
 * mirror re-render under the SdlcMirror file lock.
 */
class SdlcProgrammeRepo {
  constructor({ index, mirror }) {
    this.index = index;
    this.mirror = mirror;
  }

  async set(key, value) {
    this.index
      .prepare(
        `INSERT INTO sdlc_programme(key,value_json) VALUES(?,?)
         ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json`,
      )
      .run(key, JSON.stringify(value));
    await this.mirror.write();
  }

  get(key) {
    const r = this.index.prepare('SELECT value_json FROM sdlc_programme WHERE key=?').get(key);
    return r ? JSON.parse(r.value_json) : null;
  }

  all() {
    const out = {};
    for (const r of this.index.prepare('SELECT * FROM sdlc_programme').all()) {
      out[r.key] = JSON.parse(r.value_json);
    }
    return out;
  }
}

module.exports = { SdlcProgrammeRepo };
