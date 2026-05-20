'use strict';
const fs = require('fs');
const EPIC_HEAD = /^EPIC-(\d+):\s*(.+)$/m;
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

function indexReleasePlan({ index, markdown, rel }) {
  if (!fs.existsSync(markdown.absolute(rel))) return { counts: {}, warnings: [] };
  const ast = markdown.readAst(rel);
  const warnings = [];
  const counts = { epics: 0, stories: 0, acs: 0 };
  index.transaction(() => {
    index.exec(
      'DELETE FROM epic_dependencies; DELETE FROM story_dependencies; DELETE FROM acs; DELETE FROM planning_tasks; DELETE FROM stories; DELETE FROM epics;',
    );
    const insEpic = index.prepare(
      'INSERT INTO epics(id,title,status,release_target,source_file,source_line) VALUES(?,?,?,?,?,?)',
    );
    const insStory = index.prepare(
      'INSERT INTO stories(id,epic_id,title,status,priority,estimate,branch,pr_number,spec_path,plan_path,source_file,source_line) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    const insAc = index.prepare('INSERT INTO acs(id,story_id,checked,text,position) VALUES(?,?,?,?,?)');
    let line = 1;
    for (const node of ast) {
      if (node.kind === 'prose') {
        line += (node.text.match(/\n/g) || []).length;
        continue;
      }
      const body = node.body;
      const epicMatch = body.match(EPIC_HEAD);
      const usMatch = body.match(US_HEAD);
      const kv = parseKV(body);
      if (epicMatch && !usMatch) {
        const id = `EPIC-${epicMatch[1]}`;
        insEpic.run(id, epicMatch[2], kv.Status || 'To Do', kv['Release Target'] || null, rel, line);
        counts.epics++;
      } else if (usMatch) {
        const id = `US-${usMatch[1]}`;
        const epicId = `EPIC-${usMatch[2]}`;
        const prMatch = (kv.PR || '').match(/#(\d+)/);
        insStory.run(
          id,
          epicId,
          usMatch[3],
          kv.Status || 'To Do',
          kv.Priority || null,
          kv.Estimate || null,
          kv.Branch || null,
          prMatch ? parseInt(prMatch[1], 10) : null,
          kv.Spec || null,
          kv.Plan || null,
          rel,
          line,
        );
        counts.stories++;
        let acPos = 0;
        for (const lineText of body.split('\n')) {
          const m = lineText.match(AC_LINE);
          if (m) {
            insAc.run(`AC-${m[2]}`, id, m[1] === 'x' ? 1 : 0, m[3], acPos++);
            counts.acs++;
          }
        }
      }
      line += (node.raw.match(/\n/g) || []).length;
    }
  });
  return { counts, warnings };
}
module.exports = { indexReleasePlan };
