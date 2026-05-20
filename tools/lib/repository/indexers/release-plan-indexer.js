'use strict';
const fs = require('fs');

const EPIC_HEAD = /^EPIC-(\d+):\s*(.+)$/m;
const EPIC_HEAD_ALT = /^(EPIC-(\d+))\s*$/m; // EPIC-XXXX on its own line (alt format)
const US_HEAD = /^US-(\d+)\s+\(EPIC-(\d+)\):\s*(.+)$/m;
const KV = /^(\w[\w\s]*?):\s*(.+)$/;
const AC_LINE = /^- \[( |x)\]\s*AC-(\d+):\s*(.+)$/;

function parseKV(body) {
  const out = {};
  for (const line of body.split('\n')) {
    const m = line.match(KV);
    if (m && !/^Acceptance Criteria/i.test(m[1])) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

/**
 * Split a fenced block body into per-entity sub-sections.
 * A new section starts at every line that looks like an entity header:
 *   EPIC-XXXX: title
 *   EPIC-XXXX        (alt format)
 *   US-XXXX (EPIC-XXXX): title
 * Lines that don't start a new entity are appended to the current section.
 */
function splitEntitySections(body) {
  const ENTITY_LINE = /^(EPIC-\d+(?::|$)|US-\d+\s+\(EPIC-\d+\):)/;
  const lines = body.split('\n');
  const sections = [];
  let cur = null;
  for (const line of lines) {
    if (ENTITY_LINE.test(line)) {
      if (cur !== null) sections.push(cur);
      cur = line;
    } else if (cur !== null) {
      cur += '\n' + line;
    }
  }
  if (cur !== null) sections.push(cur);
  return sections;
}

function indexReleasePlan({ index, markdown, rel }) {
  if (!fs.existsSync(markdown.absolute(rel))) return { counts: {}, warnings: [] };
  const ast = markdown.readAst(rel);
  const warnings = [];

  // --- Pass 1: collect all entities from AST ---
  const epics = [],
    stories = [];
  let astLine = 1;

  for (const node of ast) {
    if (node.kind === 'prose') {
      astLine += (node.text.match(/\n/g) || []).length;
      continue;
    }
    const sections = splitEntitySections(node.body);
    for (const section of sections) {
      const epicMatch = section.match(EPIC_HEAD);
      const epicAltMatch = !epicMatch && section.match(EPIC_HEAD_ALT);
      const usMatch = section.match(US_HEAD);
      const kv = parseKV(section);

      if (!usMatch && (epicMatch || epicAltMatch)) {
        const id = `EPIC-${(epicMatch || epicAltMatch)[epicMatch ? 1 : 2]}`;
        const title = epicMatch ? epicMatch[2] : kv.Title || kv.title || 'Unknown';
        epics.push({
          id,
          title,
          status: kv.Status || 'To Do',
          releaseTarget: kv['Release Target'] || kv.ReleaseTarget || null,
          sourceFile: rel,
          sourceLine: astLine,
        });
      } else if (usMatch) {
        const id = `US-${usMatch[1]}`;
        const epicId = `EPIC-${usMatch[2]}`;
        const acs = [];
        let acPos = 0;
        for (const lineText of section.split('\n')) {
          const m = lineText.match(AC_LINE);
          if (m) acs.push({ id: `AC-${m[2]}`, checked: m[1] === 'x' ? 1 : 0, text: m[3], position: acPos++ });
        }
        const prMatch = (kv.PR || '').match(/#(\d+)/);
        stories.push({
          id,
          epicId,
          title: usMatch[3],
          status: kv.Status || 'To Do',
          priority: kv.Priority || null,
          estimate: kv.Estimate || null,
          branch: kv.Branch || null,
          prNumber: prMatch ? parseInt(prMatch[1], 10) : null,
          specPath: kv.Spec || null,
          planPath: kv.Plan || null,
          sourceFile: rel,
          sourceLine: astLine,
          acs,
        });
      }
    }
    astLine += (node.raw.match(/\n/g) || []).length;
  }

  // --- Pass 2: insert in dependency order ---
  const epicIds = new Set(epics.map((e) => e.id));
  const counts = { epics: 0, stories: 0, acs: 0 };

  index.transaction(() => {
    index.exec(
      'DELETE FROM epic_dependencies; DELETE FROM story_dependencies; DELETE FROM acs; DELETE FROM planning_tasks; DELETE FROM stories; DELETE FROM epics;',
    );

    const insEpic = index.prepare(
      'INSERT OR IGNORE INTO epics(id,title,status,release_target,source_file,source_line) VALUES(?,?,?,?,?,?)',
    );
    const insStory = index.prepare(
      'INSERT OR IGNORE INTO stories(id,epic_id,title,status,priority,estimate,branch,pr_number,spec_path,plan_path,source_file,source_line) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    const insAc = index.prepare('INSERT OR IGNORE INTO acs(id,story_id,checked,text,position) VALUES(?,?,?,?,?)');

    for (const e of epics) {
      insEpic.run(e.id, e.title, e.status, e.releaseTarget, e.sourceFile, e.sourceLine);
      counts.epics++;
    }
    for (const s of stories) {
      if (!epicIds.has(s.epicId)) {
        warnings.push({
          code: 'dangling-dependency',
          entityId: s.id,
          missing: s.epicId,
          message: `Story ${s.id} references epic ${s.epicId} not found in ${rel}`,
        });
        continue;
      }
      insStory.run(
        s.id,
        s.epicId,
        s.title,
        s.status,
        s.priority,
        s.estimate,
        s.branch,
        s.prNumber,
        s.specPath,
        s.planPath,
        s.sourceFile,
        s.sourceLine,
      );
      counts.stories++;
      for (const a of s.acs) {
        insAc.run(a.id, s.id, a.checked, a.text, a.position);
        counts.acs++;
      }
    }
  });
  return { counts, warnings };
}

module.exports = { indexReleasePlan };
