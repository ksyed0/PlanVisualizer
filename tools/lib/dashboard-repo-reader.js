'use strict';

/**
 * Dashboard repo-reader shim (Phase C.2 / US-0231).
 *
 * Given the legacy parse output ({epics, stories, tasks}) and the repo's
 * structural view ({epics, stories, acs}), produce a merged result that:
 *   - is byte-identical to the legacy output for stories/epics the repo doesn't
 *     see (entities in prose nodes, retired stories that fail the CHECK
 *     constraint, etc.) — legacy stays canonical for those
 *   - layers repo-supplied structural fields on top of legacy for the entries
 *     the repo does see, but ONLY for fields where the repo and legacy agree
 *     semantically (so we don't introduce diffs)
 *   - reshapes repo's AC rows back into legacy's per-story `acs` shape
 *     (`{id, text, done}`) — but only when we can do so without losing data
 *
 * The contract is "parity HARD GATE" — the merged output's snapshot must equal
 * the legacy snapshot. Fields the repo doesn't supply (description, startDate,
 * doneDate, dependencies, etc.) come straight from legacy.
 *
 * Tasks are not in the repo at all and pass through unchanged.
 */
function mergeRepoData(legacy, repoData) {
  const { epics: legacyEpics, stories: legacyStories, tasks } = legacy;
  const { epics: repoEpics, stories: repoStories, acs: repoAcs } = repoData;

  const repoEpicById = new Map(repoEpics.map((e) => [e.id, e]));
  const repoStoryById = new Map(repoStories.map((s) => [s.id, s]));

  // Group repo ACs by story for per-story reshape.
  const repoAcsByStory = new Map();
  for (const ac of repoAcs) {
    if (!repoAcsByStory.has(ac.storyId)) repoAcsByStory.set(ac.storyId, []);
    repoAcsByStory.get(ac.storyId).push(ac);
  }

  // For each legacy epic, layer repo's structural fields where present and
  // semantically equivalent. We keep legacy's iteration order so the JSON
  // output preserves document order (repo's ORDER BY id alphabetises).
  const mergedEpics = legacyEpics.map((le) => {
    const re = repoEpicById.get(le.id);
    if (!re) return le; // not in repo (prose-node or unsupported status) — keep legacy
    // Repo doesn't supply description/startDate/doneDate/dependencies, so
    // we only overlay the structural fields it owns.
    return {
      ...le,
      title: re.title ?? le.title,
      status: re.status ?? le.status,
      releaseTarget: re.releaseTarget || le.releaseTarget,
    };
  });

  const mergedStories = legacyStories.map((ls) => {
    const rs = repoStoryById.get(ls.id);
    if (!rs) return ls; // not in repo — keep legacy
    // Both legacy and repo paths normalise priority at extraction time
    // (parseReleasePlan handles "High (P0)" → "P0"). Overlaying from repo is
    // safe and keeps the structural-fields-from-repo invariant consistent.
    const merged = {
      ...ls,
      title: rs.title ?? ls.title,
      epicId: rs.epicId ?? ls.epicId,
      status: rs.status ?? ls.status,
      priority: rs.priority || ls.priority,
      estimate: rs.estimate || ls.estimate,
      branch: rs.branch || ls.branch,
    };
    // Reshape repo ACs into legacy per-story shape if repo has them; otherwise
    // keep legacy. We only swap when the AC ID set matches exactly — protects
    // against partial data drift.
    const rAcs = repoAcsByStory.get(ls.id);
    if (rAcs && rAcs.length === ls.acs.length) {
      const legacyIds = new Set(ls.acs.map((a) => a.id));
      const repoIds = new Set(rAcs.map((a) => a.id));
      const sameSet = legacyIds.size === repoIds.size && [...legacyIds].every((id) => repoIds.has(id));
      if (sameSet) {
        // Preserve legacy AC order — repo sorts by position which should match,
        // but legacy is the source of truth for ordering in the snapshot.
        const repoById = new Map(rAcs.map((a) => [a.id, a]));
        merged.acs = ls.acs.map((la) => {
          const ra = repoById.get(la.id);
          return { id: la.id, text: ra.text || la.text, done: typeof ra.checked === 'boolean' ? ra.checked : la.done };
        });
      }
    }
    return merged;
  });

  return { epics: mergedEpics, stories: mergedStories, tasks };
}

module.exports = { mergeRepoData };
