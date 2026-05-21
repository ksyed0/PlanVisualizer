'use strict';
const path = require('path');
const { openIndexDatastore } = require('./index-datastore');
const { applySchemaMigrations } = require('./schema');
const { MarkdownDatastore } = require('./markdown-datastore');
const { WarningsChannel } = require('./warnings-channel');
const { refresh } = require('./refresh');
const { EpicRepo } = require('./entities/epic-repo');
const { StoryRepo } = require('./entities/story-repo');
const { AcRepo } = require('./entities/ac-repo');
const { SdlcMirror } = require('./sdlc-mirror');
const { SdlcEventRepo } = require('./entities/sdlc-event-repo');
const { SdlcTaskRepo } = require('./entities/sdlc-task-repo');
const { SdlcProgrammeRepo } = require('./entities/sdlc-programme-repo');

const MANAGED_SOURCES = [
  'docs/RELEASE_PLAN.md',
  'docs/BUGS.md',
  'docs/LESSONS.md',
  'docs/TEST_CASES.md',
  'docs/ID_REGISTRY.md',
  'docs/sdlc-status.json',
];

let _instance = null;

class Repository {
  static getInstance(opts = {}) {
    if (_instance) return _instance;
    _instance = new Repository(opts);
    _instance.refresh();
    return _instance;
  }

  static _reset() {
    if (_instance) {
      try {
        _instance.close();
      } catch {
        /* ignore */
      }
    }
    _instance = null;
  }

  constructor({ root = path.resolve(__dirname, '../../..'), dbPath, mode } = {}) {
    this.root = root;
    this.dbPath = dbPath || path.join(root, '.cache', 'planvisualizer.db');
    this.index = openIndexDatastore({ path: this.dbPath, mode });
    applySchemaMigrations(this.index);
    this.markdown = new MarkdownDatastore({ root });
    this.warningsChannel = new WarningsChannel({ root });
    this._refreshCount = 0;
    this.epics = new EpicRepo(this.index, root);
    this.stories = new StoryRepo(this.index, root);
    this.acs = new AcRepo(this.index, root);
    this._sdlcMirror = new SdlcMirror({ root, index: this.index });
    this.sdlcEvents = new SdlcEventRepo({ index: this.index, mirror: this._sdlcMirror });
    this.sdlcTasks = new SdlcTaskRepo({ index: this.index, mirror: this._sdlcMirror });
    this.sdlcProgramme = new SdlcProgrammeRepo({ index: this.index, mirror: this._sdlcMirror });
  }

  refresh() {
    this._refreshCount++;
    return refresh({
      datastores: { index: this.index, markdown: this.markdown },
      sources: MANAGED_SOURCES,
    });
  }

  close() {
    try {
      this.index.close();
    } catch {
      /* ignore */
    }
  }
}

module.exports = { Repository, MANAGED_SOURCES };
