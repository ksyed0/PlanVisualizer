'use strict';

const fs = require('fs');
const { acquireMany } = require('./file-lock');

/**
 * Build the transaction context — shared state every tx.X.* call mutates.
 */
function makeCtx() {
  return {
    sqliteTxBegun: false,
    stagedWrites: new Map(),
    pendingFileMutations: [],
    pendingIdAllocations: new Map(),
  };
}

/**
 * Build the tx proxy that the user's callback receives. Each handle is a
 * thin facade around the corresponding repo, with the {tx: ctx} option
 * passed into every write call so the repo routes into staging.
 */
function makeProxy(repo, ctx) {
  const wrap = (under, key) => ({
    get: (id) => {
      const stagedKey = `${key}:${id}`;
      if (ctx.stagedWrites.has(stagedKey)) return ctx.stagedWrites.get(stagedKey);
      return under.get(id);
    },
    list: under.list ? under.list.bind(under) : undefined,
    update: under.update ? (id, fn) => under.update(id, fn, { tx: ctx }) : undefined,
    create: under.create ? (entity) => under.create(entity, { tx: ctx }) : undefined,
  });

  return {
    stories: wrap(repo.stories, 'story'),
    epics: wrap(repo.epics, 'epic'),
    acs: wrap(repo.acs, 'ac'),
    bugs: wrap(repo.bugs, 'bug'),
    lessons: wrap(repo.lessons, 'lesson'),
    testCases: wrap(repo.testCases, 'testCase'),
    tasks: wrap(repo.tasks, 'task'),
    idRegistry: {
      allocate: (sequence, count = 1) => repo.idRegistry.allocate(sequence, count, { tx: ctx }),
    },
  };
}

/**
 * Bind the transaction wrapper to a Repository instance.
 */
function bindTransaction(repo) {
  return async function transaction(fn) {
    const ctx = makeCtx();
    repo.index.exec('BEGIN DEFERRED');
    ctx.sqliteTxBegun = true;
    let result;
    let userError = null;
    try {
      const tx = makeProxy(repo, ctx);
      result = await fn(tx);
    } catch (err) {
      userError = err;
    }
    if (userError) {
      try {
        repo.index.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      ctx.sqliteTxBegun = false;
      throw userError;
    }
    const paths = [...new Set(ctx.pendingFileMutations.map((m) => m.path))];
    if (paths.length === 0) {
      repo.index.exec('COMMIT');
      ctx.sqliteTxBegun = false;
      return result;
    }
    let release;
    try {
      release = await acquireMany(paths);
      const byPath = new Map();
      for (const m of ctx.pendingFileMutations) {
        if (!byPath.has(m.path)) byPath.set(m.path, []);
        byPath.get(m.path).push(m.mutator);
      }
      for (const [p, mutators] of byPath) {
        let text = fs.readFileSync(p, 'utf8');
        for (const mut of mutators) text = mut(text);
        const tmp = p + '.tmp';
        fs.writeFileSync(tmp, text);
        fs.renameSync(tmp, p);
      }
      repo.index.exec('COMMIT');
      ctx.sqliteTxBegin = false;
    } catch (err) {
      try {
        repo.index.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      ctx.sqliteTxBegun = false;
      throw err;
    } finally {
      if (release) await release();
    }
    return result;
  };
}

module.exports = { bindTransaction, makeCtx, makeProxy };
