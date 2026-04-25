#!/usr/bin/env node
'use strict';

/**
 * Plan Visualizer
 * Run: node tools/generate-plan.js
 * Output: <docs.outputDir>/plan-status.html + <docs.outputDir>/plan-status.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { parseReleasePlan } = require('./lib/parse-release-plan');
const { parseTestCases } = require('./lib/parse-test-cases');
const { parseBugs } = require('./lib/parse-bugs');
const { parseCostLog, deduplicateSessions, aggregateCostByBranch } = require('./lib/parse-cost-log');
const { parseCoverage } = require('./lib/parse-coverage');
const { parseRecentActivity } = require('./lib/parse-progress');
const { parseLessons } = require('./lib/parse-lessons');
const { computeProjectedCost, attributeAICosts, attributeBugCosts } = require('./lib/compute-costs');
const { detectAtRisk } = require('./lib/detect-at-risk');
const { computeAllRisk } = require('./lib/compute-risk');
const { saveSnapshot, loadSnapshots, extractTrends } = require('./lib/snapshot');
const { computeBudgetMetrics, generateBudgetCSV } = require('./lib/budget');
const { renderHtml } = require('./lib/render-html');
const { backfillHistory, calculateAvgTokensPerEstimate, estimateStoryCost } = require('./lib/historical-sim');

const TOKEN_RATES = { input: 3, output: 15 };

const ROOT = path.join(__dirname, '..');

// Load agents config (agents.config.json) — used by About modal + Agent Workload widget.
let AGENTS_CONFIG = {};
try {
  const agentsCfgPath = path.join(ROOT, 'agents.config.json');
  if (fs.existsSync(agentsCfgPath)) AGENTS_CONFIG = JSON.parse(fs.readFileSync(agentsCfgPath, 'utf8'));
} catch (e) {
  console.warn('[generate-plan] Could not load agents.config.json:', e.message);
}

const DEFAULTS = {
  project: { name: 'NomadCode', tagline: 'Code from anywhere.' },
  docs: {
    releasePlan: 'docs/RELEASE_PLAN.md',
    testCases: 'docs/TEST_CASES.md',
    bugs: 'docs/BUGS.md',
    costLog: 'docs/AI_COST_LOG.md',
    lessons: 'docs/LESSONS.md',
    outputDir: 'docs',
  },
  coverage: { summaryPath: 'docs/coverage/coverage-summary.json' },
  progress: { path: 'progress.md' },
  costs: { hourlyRate: 100, tshirtHours: { XS: 2, S: 4, M: 8, L: 16, XL: 32 } },
  budget: { totalUsd: null, byEpic: {}, thresholds: [50, 75, 90, 100] },
};

function loadConfig() {
  const cfgPath = path.join(ROOT, 'plan-visualizer.config.json');
  if (!fs.existsSync(cfgPath)) return DEFAULTS;
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const KNOWN_KEYS = ['project', 'docs', 'coverage', 'progress', 'costs', 'budget'];
    Object.keys(raw).forEach((k) => {
      if (!KNOWN_KEYS.includes(k)) console.warn(`[generate-plan] Unknown config key: "${k}" — ignored`);
    });
    return {
      project: { ...DEFAULTS.project, ...raw.project },
      docs: { ...DEFAULTS.docs, ...raw.docs },
      coverage: { ...DEFAULTS.coverage, ...raw.coverage },
      progress: { ...DEFAULTS.progress, ...raw.progress },
      costs: {
        hourlyRate: raw.costs?.hourlyRate ?? DEFAULTS.costs.hourlyRate,
        tshirtHours: {
          ...DEFAULTS.costs.tshirtHours,
          ...raw.costs?.tshirtHours,
        },
      },
      budget: {
        totalUsd: raw.budget?.totalUsd ?? DEFAULTS.budget.totalUsd,
        byEpic: { ...DEFAULTS.budget.byEpic, ...raw.budget?.byEpic },
        thresholds: raw.budget?.thresholds ?? DEFAULTS.budget.thresholds,
      },
    };
  } catch (e) {
    console.warn('[generate-plan] Failed to parse plan-visualizer.config.json; using defaults.', e.message);
    return DEFAULTS;
  }
}

function readFile(relPath) {
  const full = path.join(ROOT, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function readJson(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

function getCommitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getBuildNumber() {
  try {
    return execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '0';
  }
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getAppVersion() {
  // Read PlanVisualizer tool's own package.json (one level up from tools/)
  try {
    const appPkgPath = path.join(__dirname, '..', 'package.json');
    const appPkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));
    return { name: appPkg.name || 'plan-visualizer', version: appPkg.version || '0.0.0' };
  } catch {
    return { name: 'plan-visualizer', version: '0.0.0' };
  }
}

function computeCompletion(stories, trends) {
  if (!trends || !trends.dates || trends.dates.length < 2) return null;
  const TSHIRT = { XS: 0.5, S: 1, M: 3, L: 5, XL: 8 };
  const pts = (s) => {
    const e = s.estimate ? s.estimate.toUpperCase() : null;
    return (e && TSHIRT[e]) || 1;
  };
  const done = stories.filter((s) => s.status === 'Done');
  if (done.length < 2) return null;
  const completedPts = done.reduce((sum, s) => sum + pts(s), 0);
  const remainingPts = stories
    .filter((s) => s.status !== 'Done' && s.status !== 'Retired')
    .reduce((sum, s) => sum + pts(s), 0);
  if (remainingPts === 0) return null;
  const firstDate = new Date(trends.dates[0]);
  const lastDate = new Date(trends.dates[trends.dates.length - 1]);
  const weeksElapsed = (lastDate - firstDate) / (7 * 24 * 60 * 60 * 1000);
  if (weeksElapsed < 1) return null;
  const ptsPerWeek = completedPts / weeksElapsed;
  if (ptsPerWeek <= 0) return null;
  const weeksRemaining = remainingPts / ptsPerWeek;
  const likelyMs = lastDate.getTime() + weeksRemaining * 7 * 24 * 60 * 60 * 1000;
  const rangeMs = weeksRemaining * 0.2 * 7 * 24 * 60 * 60 * 1000;
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (d) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  return {
    likelyDate: fmt(new Date(likelyMs)),
    rangeStart: fmt(new Date(likelyMs - rangeMs)),
    rangeEnd: fmt(new Date(likelyMs + rangeMs)),
    velocityWeeks: Math.round(weeksElapsed),
  };
}

function main() {
  const config = loadConfig();
  const HOURS = config.costs.tshirtHours;
  const RATE = config.costs.hourlyRate;

  console.log('[generate-plan] Reading source files...');

  const { epics, stories, tasks } = parseReleasePlan(readFile(config.docs.releasePlan));
  const testCases = parseTestCases(readFile(config.docs.testCases));
  const bugs = parseBugs(readFile(config.docs.bugs));
  const costRows = parseCostLog(readFile(config.docs.costLog));
  const costByBranch = aggregateCostByBranch(costRows);
  const coverageJson = readJson(config.coverage.summaryPath);
  const coverage = coverageJson
    ? parseCoverage(coverageJson)
    : {
        lines: 0,
        statements: 0,
        functions: 0,
        branches: 0,
        overall: 0,
        meetsTarget: false,
        available: false,
      };
  const recentActivity = parseRecentActivity(readFile(config.progress.path), 5);
  const lessons = parseLessons(readFile(config.docs.lessons));

  // Back-fill lessonEncoded on bugs using LESSONS.md **Bugs:** as source of truth.
  // parse-bugs reads this field from docs/BUGS.md which has no Lesson Encoded entries,
  // so we derive it here from the inverse mapping in LESSONS.md.
  const bugToLesson = {};
  for (const lesson of lessons) {
    for (const bugId of lesson.bugIds || []) {
      if (!bugToLesson[bugId]) bugToLesson[bugId] = lesson.id;
    }
  }
  for (const bug of bugs) {
    if (!bug.lessonEncoded && bugToLesson[bug.id]) {
      bug.lessonEncoded = `Yes — ${bugToLesson[bug.id]}`;
    }
  }

  const aiAttribution = attributeAICosts(stories, costByBranch);
  const avgTokens = calculateAvgTokensPerEstimate({
    stories,
    costs: aiAttribution,
  });
  const hasRealCosts = Object.values(aiAttribution).some((c) => c && c.costUsd > 0);

  const costs = {};
  for (const story of stories) {
    let projectedUsd;
    if (story.status === 'Done' || story.status === 'In Progress') {
      projectedUsd = computeProjectedCost(story.estimate, HOURS, RATE);
    } else if (hasRealCosts && avgTokens && Object.keys(avgTokens).length > 0) {
      projectedUsd = estimateStoryCost(story.estimate, avgTokens, TOKEN_RATES.input, TOKEN_RATES.output);
    } else {
      projectedUsd = computeProjectedCost(story.estimate, HOURS, RATE);
    }

    costs[story.id] = {
      projectedUsd: projectedUsd,
      costUsd: aiAttribution[story.id] ? aiAttribution[story.id].costUsd : 0,
      inputTokens: aiAttribution[story.id] ? aiAttribution[story.id].inputTokens : 0,
      outputTokens: aiAttribution[story.id] ? aiAttribution[story.id].outputTokens : 0,
    };
  }
  costs._totals = aiAttribution._totals || {
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
  costs._bugs = attributeBugCosts(bugs, costByBranch);

  const SEVERITY_SIZE = { Critical: 'L', High: 'M', Medium: 'S', Low: 'S' };
  for (const bug of bugs) {
    if (costs._bugs[bug.id]) {
      const size = SEVERITY_SIZE[bug.severity] || 'S';
      costs._bugs[bug.id].projectedUsd = computeProjectedCost(size, HOURS, RATE);
    }
  }

  const atRisk = detectAtRisk(stories, testCases, bugs);
  const risk = computeAllRisk(stories, bugs);
  const generatedAt = new Date().toISOString();
  const commitSha = getCommitSha();
  const buildNumber = getBuildNumber();
  const branch = getCurrentBranch();
  const app = getAppVersion();
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  } catch (err) {
    let msg = 'Failed to read package.json';
    if (err instanceof Error) msg += ': ' + err.message;
    throw new Error(msg, { cause: err });
  }

  const sessionTimeline = deduplicateSessions(costRows)
    .filter((row) => !row.branch.startsWith('est/'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce((acc, row) => {
      const prev = acc.length ? acc[acc.length - 1].cumCost : 0;
      acc.push({
        date: row.date,
        cumCost: parseFloat((prev + row.costUsd).toFixed(4)),
      });
      return acc;
    }, []);

  // Group deduplicated cost rows by branch for sparklines (US-0105)
  const costHistory = {};
  deduplicateSessions(costRows)
    .filter((row) => !row.branch.startsWith('est/'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((row) => {
      if (!costHistory[row.branch]) costHistory[row.branch] = [];
      costHistory[row.branch].push({ date: row.date, costUsd: row.costUsd });
    });

  // Delta spend: cost of most recent session vs previous (US-0105)
  const deltaSpend =
    sessionTimeline.length >= 2
      ? parseFloat(
          (
            sessionTimeline[sessionTimeline.length - 1].cumCost - sessionTimeline[sessionTimeline.length - 2].cumCost
          ).toFixed(2),
        )
      : null;

  const data = {
    epics,
    stories,
    tasks,
    testCases,
    bugs,
    costs,
    atRisk,
    risk,
    coverage,
    recentActivity,
    lessons,
    generatedAt,
    commitSha,
    buildNumber,
    branch,
    sessionTimeline,
    costHistory,
    deltaSpend,
    projectName: config.project.name,
    tagline: config.project.tagline,
    version: pkg.version,
    appName: app.name,
    appVersion: app.version,
    githubUrl: config.project.githubUrl ?? '',
    agents: AGENTS_CONFIG.agents || {},
  };

  console.log('[generate-plan] Saving snapshot...');
  const snapshotData = {
    epics,
    stories,
    bugs,
    costs,
    coverage,
    lessons,
    testCases,
  };
  saveSnapshot(snapshotData, { root: ROOT, commit: commitSha });

  console.log('[generate-plan] Loading historical snapshots...');
  let snapshots = loadSnapshots({ root: ROOT });

  if (snapshots.length < 2) {
    console.log('[generate-plan] Less than 2 snapshots found, attempting historical backfill...');
    const backfillResult = backfillHistory({ root: ROOT, days: 30 });
    if (!backfillResult.skipped) {
      console.log('[generate-plan] Reloading snapshots after backfill...');
      snapshots = loadSnapshots({ root: ROOT });
    }
  }

  const trends = extractTrends(snapshots);

  console.log('[generate-plan] Computing budget metrics...');
  const budgetMetrics = computeBudgetMetrics(data, config, snapshots);
  const budgetCSV = generateBudgetCSV(data, budgetMetrics, snapshots);

  data.budget = budgetMetrics;
  data.completion = computeCompletion(data.stories, trends);
  data.trends = trends;

  const outputDir = path.join(ROOT, config.docs.outputDir);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, 'plan-status.json');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[generate-plan] Written ${jsonPath}`);

  const html = renderHtml(data, { trends, budgetCSV });
  const htmlPath = path.join(outputDir, 'plan-status.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`[generate-plan] Written ${htmlPath}`);
  console.log(
    `[generate-plan] Done. ${epics.length} epics, ${stories.length} stories, ${testCases.length} TCs, ${bugs.length} bugs, ${lessons.length} lessons.`,
  );
}

function watch(config) {
  const watchFiles = [
    config.docs.releasePlan,
    config.docs.testCases,
    config.docs.bugs,
    config.docs.costLog,
    config.docs.lessons,
    config.progress.path,
  ].map((f) => path.join(ROOT, f));

  console.log('[generate-plan] Watching for changes...');
  let debounce = null;
  for (const file of watchFiles) {
    if (!fs.existsSync(file)) continue;
    fs.watch(file, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        console.log(`[generate-plan] Change detected, regenerating...`);
        try {
          main();
        } catch (e) {
          console.error('[generate-plan] Error:', e.message);
        }
      }, 1000);
    });
  }
}

try {
  main();
  if (process.argv.includes('--watch')) {
    watch(loadConfig());
  }
} catch (e) {
  console.error('[generate-plan] Fatal:', e.message);
  console.error('[generate-plan] Stack:', e.stack);
  process.exit(1);
}
