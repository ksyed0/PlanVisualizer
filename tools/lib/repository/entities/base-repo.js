'use strict';
class BaseRepo {
  constructor({ index, table, mapRow, root }) {
    this.index = index;
    this.table = table;
    this.mapRow = mapRow;
    this._root = root; // reserved for future write APIs (Phase D/E) that locate the source markdown file
  }
  get(id) {
    const row = this.index.prepare(`SELECT * FROM ${this.table} WHERE id=?`).get(id);
    return row ? this.mapRow(row) : null;
  }
  list() {
    return this.index.prepare(`SELECT * FROM ${this.table}`).all().map(this.mapRow);
  }
}
module.exports = { BaseRepo };
