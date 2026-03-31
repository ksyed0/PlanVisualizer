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
const { saveSnapshot, loadSnapshots, extractTrends } = require('./lib/snapshot');
const { computeBudgetMetrics, generateBudgetCSV } = require('./lib/budget');
const { renderHtml } = require('./lib/render-html');
const { backfillHistory, calculateAvgTokensPerEstimate, estimateStoryCost } = require('./lib/historical-sim');

const TOKEN_RATES = { input: 3, output: 15 };

const ROOT = path.join(__dirname, '..');

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
    Object.keys(raw).forEach(k => {
      if (!KNOWN_KEYS.includes(k)) console.warn(`[generate-plan] Unknown config key: "${k}" — ignored`);
    });
    return {
      project: { ...DEFAULTS.project, ...raw.project },
      docs: { ...DEFAULTS.docs, ...raw.docs },
      coverage: { ...DEFAULTS.coverage, ...raw.coverage },
      progress: { ...DEFAULTS.progress, ...raw.progress },
      costs: {
        hourlyRate: raw.costs?.hourlyRate ?? DEFAULTS.costs.hourlyRate,
        tshirtHours: { ...DEFAULTS.costs.tshirtHours, ...raw.costs?.tshirtHours },
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
  try { return JSON.parse(fs.readFileSync(full, 'utf8')); } catch { return null; }
}

function getCommitSha() {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
}

function getBuildNumber() {
  try { return execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim(); } catch { return '0'; }
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
    : { lines: 0, statements: 0, functions: 0, branches: 0, overall: 0, meetsTarget: false, available: false };
  const recentActivity = parseRecentActivity(readFile(config.progress.path), 5);
  const lessons = parseLessons(readFile(config.docs.lessons));

  const aiAttribution = attributeAICosts(stories, costByBranch);
  const avgTokens = calculateAvgTokensPerEstimate({ stories, costs: aiAttribution });
  const hasRealCosts = Object.values(aiAttribution).some(c => c && c.costUsd > 0);
  
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
  costs._totals = aiAttribution._totals || { costUsd: 0, inputTokens: 0, outputTokens: 0 };
  costs._bugs = attributeBugCosts(bugs, costByBranch);

  const SEVERITY_SIZE = { Critical: 'L', High: 'M', Medium: 'S', Low: 'S' };
  for (const bug of bugs) {
    if (costs._bugs[bug.id]) {
      const size = SEVERITY_SIZE[bug.severity] || 'S';
      costs._bugs[bug.id].projectedUsd = computeProjectedCost(size, HOURS, RATE);
    }
  }

  const atRisk = detectAtRisk(stories, testCases, bugs);
  const generatedAt = new Date().toISOString();
  const commitSha = getCommitSha();
  const buildNumber = getBuildNumber();
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  } catch (err) {
    let msg = 'Failed to read package.json';
    if (err instanceof Error) msg += ': ' + err.message;
    throw new Error(msg);
  }

  const sessionTimeline = deduplicateSessions(costRows)
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce((acc, row) => {
      const prev = acc.length ? acc[acc.length - 1].cumCost : 0;
      acc.push({ date: row.date, cumCost: parseFloat((prev + row.costUsd).toFixed(4)) });
      return acc;
    }, []);

  const data = {
    epics, stories, tasks, testCases, bugs, costs, atRisk, coverage,
    recentActivity, lessons, generatedAt, commitSha, buildNumber, sessionTimeline,
    projectName: config.project.name,
    tagline: config.project.tagline,
    version: pkg.version,
    githubUrl: config.project.githubUrl ?? '',
  };

  console.log('[generate-plan] Saving snapshot...');
  const snapshotData = { epics, stories, bugs, costs, coverage, lessons, testCases };
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

  const outputDir = path.join(ROOT, config.docs.outputDir);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, 'plan-status.json');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[generate-plan] Written ${jsonPath}`);

  const html = renderHtml(data, { trends, budgetCSV });
  const htmlPath = path.join(outputDir, 'plan-status.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`[generate-plan] Written ${htmlPath}`);
  console.log(`[generate-plan] Done. ${epics.length} epics, ${stories.length} stories, ${testCases.length} TCs, ${bugs.length} bugs, ${lessons.length} lessons.`);
}

try { main(); } catch (e) { console.error('[generate-plan] Fatal:', e.message); process.exit(1); }
