'use strict';
const { buildIssueBody, buildIssueTitle } = require('../../tools/lib/github-client');

describe('github-client — buildIssueTitle', () => {
  it('formats BUG ID correctly', () => {
    expect(buildIssueTitle('BUG-0253', 'Session fails silently')).toBe('[BUG-0253] Session fails silently');
  });

  it('formats US ID correctly', () => {
    expect(buildIssueTitle('US-0171', 'GitHub sync engine')).toBe('[US-0171] GitHub sync engine');
  });
});

describe('github-client — buildIssueBody', () => {
  it('includes steps, expected, actual when provided', () => {
    const bug = {
      id: 'BUG-0253',
      title: 'Session fails',
      severity: 'High',
      status: 'Open',
      stepsToReproduce: '1. Do X',
      expected: 'Works',
      actual: 'Crashes',
    };
    const body = buildIssueBody(bug);
    expect(body).toContain('Steps to Reproduce');
    expect(body).toContain('1. Do X');
    expect(body).toContain('Expected');
    expect(body).toContain('Works');
    expect(body).toContain('Actual');
    expect(body).toContain('Crashes');
    expect(body).toContain('BUG-0253');
  });

  it('handles missing fields gracefully', () => {
    const bug = { id: 'BUG-0254', title: 'Crash', severity: 'Low', status: 'Open' };
    expect(() => buildIssueBody(bug)).not.toThrow();
  });
});
