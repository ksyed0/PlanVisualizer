# US-0175 Memory Token Optimisation — PR A Tooling (Session 43, 2026-05-10)

- **New modules shipped:** `tools/lib/memory-{parser,classifier,archiver,index,validator,migrator}.js` + `tools/memory.js` CLI. 6 libs are independently testable; CLI thin wrapper dispatches to them.
- **`parseMemory(text)`** — splits MEMORY.md on `## ` H2 boundaries → `{header, sections[{heading,body,raw}]}`.
- **`classifySection(title)`** — `(as of` → snapshots; `(Session N` or `^Session N` → sessions; `Lessons Learned` → special; else → topics. Slug rule: strip parens/em-dashes, lowercase, non-alphanum→dash, truncate at 60 chars.
- **`selectForArchive(files, {now,staleDays})`** — topics/sessions stale when `now-mtime > staleDays*86400*1000` (strictly >). Snapshots: group by scope (text before `(`), keep newest date per scope, archive rest.
- **`compactMemory({root})`** — reads `docs/memory/{topics,sessions,snapshots}/`, renders compact MEMORY.md with grouped link list. No-op when `docs/memory/` missing.
- **`migrateMemory({root,dry,force})`** — one-time bootstrap: parse MEMORY.md, classify, write topic files (mtime from `git log -S "## heading" MEMORY.md`), archive superseded snapshots, triage `## Lessons Learned` against LESSONS.md, regenerate MEMORY.md.
- **`generate-plan.js`** calls `compactMemory()` + conditional `archiveStaleMemory()` (when `config.memory.autoArchive===true`) after `loadConfig()`.
- **CodeQL TOCTOU fix:** `statSync(fp)+readFileSync(fp)` pattern replaced with `readFileSafe(fp)` using `openSync+fstatSync+readSync` via fd — eliminates `js/file-system-race` alerts.
- **PR B (migration not yet run):** `node tools/memory.js migrate` will split real MEMORY.md into `docs/memory/` and rewrite it as ~500-token compact index. Run on develop after pulling PR A.
- **`config.memory`:** `{ staleDays: 90, autoArchive: false }` — configurable in Settings tab Memory card.

---
