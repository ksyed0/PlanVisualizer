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
const { parseCostLog, aggregateCostByBranch } = require('./lib/parse-cost-log');
const { parseCoverage } = require('./lib/parse-coverage');
const { parseRecentActivity } = require('./lib/parse-progress');
const { computeProjectedCost, attributeAICosts } = require('./lib/compute-costs');
const { detectAtRisk } = require('./lib/detect-at-risk');
const { renderHtml } = require('./lib/render-html');

const ROOT = path.join(__dirname, '..');

const DEFAULTS = {
  project: { name: 'NomadCode', tagline: 'Code from anywhere.' },
  docs: {
    releasePlan: 'Docs/RELEASE_PLAN.md',
    testCases: 'Docs/TEST_CASES.md',
    bugs: 'Docs/BUGS.md',
    costLog: 'Docs/AI_COST_LOG.md',
    outputDir: 'Docs',
  },
  coverage: { summaryPath: 'Docs/coverage/coverage-summary.json' },
  progress: { path: 'progress.md' },
  costs: { hourlyRate: 100, tshirtHours: { S: 4, M: 8, L: 16, XL: 32 } },
};

function loadConfig() {
  const cfgPath = path.join(ROOT, 'plan-visualizer.config.json');
  if (!fs.existsSync(cfgPath)) return DEFAULTS;
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return {
      project: { ...DEFAULTS.project, ...raw.project },
      docs: { ...DEFAULTS.docs, ...raw.docs },
      coverage: { ...DEFAULTS.coverage, ...raw.coverage },
      progress: { ...DEFAULTS.progress, ...raw.progress },
      costs: {
        hourlyRate: raw.costs?.hourlyRate ?? DEFAULTS.costs.hourlyRate,
        tshirtHours: { ...DEFAULTS.costs.tshirtHours, ...raw.costs?.tshirtHours },
      },
    };
  } catch { return DEFAULTS; }
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
    : { lines: 0, statements: 0, functions: 0, branches: 0, overall: 0, meetsTarget: false };
  const recentActivity = parseRecentActivity(readFile(config.progress.path), 5);

  const aiAttribution = attributeAICosts(stories, costByBranch);
  const costs = {};
  for (const story of stories) {
    costs[story.id] = {
      projectedUsd: computeProjectedCost(story.estimate, HOURS, RATE),
      aiCostUsd: aiAttribution[story.id] ? aiAttribution[story.id].costUsd : 0,
      inputTokens: aiAttribution[story.id] ? aiAttribution[story.id].inputTokens : 0,
      outputTokens: aiAttribution[story.id] ? aiAttribution[story.id].outputTokens : 0,
    };
  }
  costs._totals = aiAttribution._totals || { costUsd: 0, inputTokens: 0, outputTokens: 0 };

  const atRisk = detectAtRisk(stories, testCases, bugs);
  const generatedAt = new Date().toISOString();
  const commitSha = getCommitSha();

  const sessionTimeline = [...costRows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce((acc, row) => {
      const prev = acc.length ? acc[acc.length - 1].cumCost : 0;
      acc.push({ date: row.date, cumCost: parseFloat((prev + row.costUsd).toFixed(4)) });
      return acc;
    }, []);

  const data = {
    epics, stories, tasks, testCases, bugs, costs, atRisk, coverage,
    recentActivity, generatedAt, commitSha, sessionTimeline,
    projectName: config.project.name,
    tagline: config.project.tagline,
  };

  const outputDir = path.join(ROOT, config.docs.outputDir);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, 'plan-status.json');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[generate-plan] Written ${jsonPath}`);

  const html = renderHtml(data);
  const htmlPath = path.join(outputDir, 'plan-status.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`[generate-plan] Written ${htmlPath}`);
  console.log(`[generate-plan] Done. ${epics.length} epics, ${stories.length} stories, ${testCases.length} TCs, ${bugs.length} bugs.`);
}

main();
