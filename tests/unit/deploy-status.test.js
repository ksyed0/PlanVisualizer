'use strict';

const { HANDLERS, parseArgs, BLANK_STATUS } = require('../../tools/deploy-status');

function baseState() {
  return JSON.parse(JSON.stringify(BLANK_STATUS));
}

// ── parseArgs ──────────────────────────────────────────────────────────────

describe('deploy-status — parseArgs', () => {
  it('parses command and flag pairs', () => {
    const { cmd, opts } = parseArgs([
      'node',
      'x',
      'deploy-start',
      '--env',
      'staging',
      '--sha',
      'abc123',
      '--story',
      'US-0264',
    ]);
    expect(cmd).toBe('deploy-start');
    expect(opts.env).toBe('staging');
    expect(opts.sha).toBe('abc123');
    expect(opts.story).toBe('US-0264');
  });

  it('sets boolean true for lone flags', () => {
    const { opts } = parseArgs(['node', 'x', 'init', '--no-overwrite']);
    expect(opts['no-overwrite']).toBe(true);
  });
});

// ── init ───────────────────────────────────────────────────────────────────

describe('deploy-status — init', () => {
  it('returns blank status with all three environments idle', () => {
    const result = HANDLERS.init({}, {});
    expect(result.environments.dev.status).toBe('idle');
    expect(result.environments.staging.status).toBe('idle');
    expect(result.environments.production.status).toBe('idle');
    expect(result.activeDeployment).toBeNull();
    expect(result.ciRuns).toEqual([]);
    expect(result.incidents).toEqual([]);
    expect(result.promotionHistory).toEqual([]);
  });
});

// ── deploy-start ───────────────────────────────────────────────────────────

describe('deploy-status — deploy-start', () => {
  it('sets env to deploying and records activeDeployment', () => {
    const data = baseState();
    const result = HANDLERS['deploy-start'](data, { env: 'staging', sha: 'abc123', story: 'US-0264', from: 'dev' });
    expect(result.environments.staging.status).toBe('deploying');
    expect(result.activeDeployment).toMatchObject({ to: 'staging', sha: 'abc123', story: 'US-0264', from: 'dev' });
    expect(result.activeDeployment.startedAt).toBeTruthy();
  });

  it('throws if --env missing', () => {
    expect(() => HANDLERS['deploy-start'](baseState(), { sha: 'abc', story: 'US-0264' })).toThrow('--env required');
  });

  it('throws if --sha missing', () => {
    expect(() => HANDLERS['deploy-start'](baseState(), { env: 'staging', story: 'US-0264' })).toThrow('--sha required');
  });
});

// ── deploy-complete ────────────────────────────────────────────────────────

describe('deploy-status — deploy-complete', () => {
  it('sets env healthy, records sha, clears activeDeployment', () => {
    const data = baseState();
    data.environments.staging.status = 'deploying';
    data.activeDeployment = {
      from: 'dev',
      to: 'staging',
      sha: 'abc123',
      story: 'US-0264',
      startedAt: new Date().toISOString(),
    };
    const result = HANDLERS['deploy-complete'](data, { env: 'staging', sha: 'abc123', story: 'US-0264' });
    expect(result.environments.staging.status).toBe('healthy');
    expect(result.environments.staging.sha).toBe('abc123');
    expect(result.environments.staging.lastDeployStory).toBe('US-0264');
    expect(result.environments.staging.lastDeployAt).toBeTruthy();
    expect(result.activeDeployment).toBeNull();
  });

  it('throws if --env missing', () => {
    expect(() => HANDLERS['deploy-complete'](baseState(), { sha: 'abc' })).toThrow('--env required');
  });
});

// ── deploy-fail ────────────────────────────────────────────────────────────

describe('deploy-status — deploy-fail', () => {
  it('sets env to degraded and clears activeDeployment', () => {
    const data = baseState();
    data.activeDeployment = { to: 'production', sha: 'abc', story: 'US-0264', startedAt: '' };
    const result = HANDLERS['deploy-fail'](data, { env: 'production', reason: 'health check failed' });
    expect(result.environments.production.status).toBe('degraded');
    expect(result.activeDeployment).toBeNull();
  });

  it('throws if --reason missing', () => {
    expect(() => HANDLERS['deploy-fail'](baseState(), { env: 'production' })).toThrow('--reason required');
  });
});

// ── rollback ───────────────────────────────────────────────────────────────

describe('deploy-status — rollback', () => {
  it('sets env to rolled-back, updates sha, appends rollback to promotionHistory', () => {
    const data = baseState();
    data.environments.production.sha = 'bad123';
    const result = HANDLERS.rollback(data, { env: 'production', 'to-sha': 'good456', reason: 'health check down' });
    expect(result.environments.production.status).toBe('rolled-back');
    expect(result.environments.production.sha).toBe('good456');
    expect(result.environments.production.lastDeployAt).toBeTruthy();
    expect(result.promotionHistory).toHaveLength(1);
    expect(result.promotionHistory[0].rollback).toBe(true);
    expect(result.promotionHistory[0].reason).toBe('health check down');
  });

  it('trims promotionHistory to last 100', () => {
    const data = baseState();
    data.promotionHistory = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const result = HANDLERS.rollback(data, { env: 'staging', 'to-sha': 'abc', reason: 'test' });
    expect(result.promotionHistory).toHaveLength(100);
  });

  it('throws if --to-sha missing', () => {
    expect(() => HANDLERS.rollback(baseState(), { env: 'production', reason: 'x' })).toThrow('--to-sha required');
  });
});

// ── promote ────────────────────────────────────────────────────────────────

describe('deploy-status — promote', () => {
  it('appends a promotion entry to promotionHistory', () => {
    const data = baseState();
    const result = HANDLERS.promote(data, { from: 'staging', to: 'production', sha: 'abc123', story: 'US-0264' });
    expect(result.promotionHistory).toHaveLength(1);
    expect(result.promotionHistory[0]).toMatchObject({
      from: 'staging',
      to: 'production',
      sha: 'abc123',
      story: 'US-0264',
    });
    expect(result.promotionHistory[0].promotedAt).toBeTruthy();
  });

  it('trims promotionHistory to last 100', () => {
    const data = baseState();
    data.promotionHistory = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const result = HANDLERS.promote(data, { from: 'staging', to: 'production', sha: 'abc' });
    expect(result.promotionHistory).toHaveLength(100);
  });

  it('throws if --from missing', () => {
    expect(() => HANDLERS.promote(baseState(), { to: 'production', sha: 'abc' })).toThrow('--from required');
  });
});

// ── health-check ───────────────────────────────────────────────────────────

describe('deploy-status — health-check', () => {
  it('maps ok → healthy', () => {
    const result = HANDLERS['health-check'](baseState(), { env: 'dev', status: 'ok' });
    expect(result.environments.dev.status).toBe('healthy');
  });

  it('maps warn → degraded', () => {
    const result = HANDLERS['health-check'](baseState(), { env: 'staging', status: 'warn' });
    expect(result.environments.staging.status).toBe('degraded');
  });

  it('maps fail → down', () => {
    const result = HANDLERS['health-check'](baseState(), { env: 'production', status: 'fail' });
    expect(result.environments.production.status).toBe('down');
  });

  it('throws if --env missing', () => {
    expect(() => HANDLERS['health-check'](baseState(), { status: 'ok' })).toThrow('--env required');
  });
});

// ── ci-status ──────────────────────────────────────────────────────────────

describe('deploy-status — ci-status', () => {
  it('appends a ciRun entry with recordedAt timestamp', () => {
    const data = baseState();
    const result = HANDLERS['ci-status'](data, { workflow: 'plan-visualizer.yml', status: 'passed' });
    expect(result.ciRuns).toHaveLength(1);
    expect(result.ciRuns[0]).toMatchObject({ workflow: 'plan-visualizer.yml', status: 'passed' });
    expect(result.ciRuns[0].recordedAt).toBeTruthy();
  });

  it('trims ciRuns to last 20', () => {
    const data = baseState();
    data.ciRuns = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const result = HANDLERS['ci-status'](data, { workflow: 'x', status: 'passed' });
    expect(result.ciRuns).toHaveLength(20);
  });

  it('throws if --workflow missing', () => {
    expect(() => HANDLERS['ci-status'](baseState(), { status: 'passed' })).toThrow('--workflow required');
  });
});

// ── incident ───────────────────────────────────────────────────────────────

describe('deploy-status — incident', () => {
  it('appends an incident with auto-incremented id', () => {
    const data = baseState();
    const result = HANDLERS.incident(data, {
      env: 'production',
      type: 'code',
      severity: 'high',
      description: 'Null pointer in auth handler',
      resolution: 'Dispatch Forge to fix auth.js',
      owner: 'Forge',
    });
    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0].id).toBe(1);
    expect(result.incidents[0].severity).toBe('high');
    expect(result.incidents[0].suggestedOwner).toBe('Forge');
    expect(result.incidents[0].resolvedAt).toBeNull();
    expect(result.incidents[0].openedAt).toBeTruthy();
  });

  it('auto-increments id based on existing incidents length', () => {
    const data = baseState();
    data.incidents = [{ id: 1 }, { id: 2 }];
    const result = HANDLERS.incident(data, {
      env: 'staging',
      type: 'infra',
      severity: 'low',
      description: 'Slow response',
      resolution: 'Restart service',
    });
    expect(result.incidents[2].id).toBe(3);
  });

  it('trims incidents to last 50', () => {
    const data = baseState();
    data.incidents = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
    const result = HANDLERS.incident(data, {
      env: 'production',
      type: 'infra',
      severity: 'low',
      description: 'test',
      resolution: 'test',
    });
    expect(result.incidents).toHaveLength(50);
    expect(result.incidents[49].id).toBe(51);
  });

  it('throws if --description missing', () => {
    expect(() =>
      HANDLERS.incident(baseState(), { env: 'production', type: 'code', severity: 'high', resolution: 'fix it' }),
    ).toThrow('--description required');
  });

  it('throws if --resolution missing', () => {
    expect(() =>
      HANDLERS.incident(baseState(), { env: 'production', type: 'code', severity: 'high', description: 'broke' }),
    ).toThrow('--resolution required');
  });
});
