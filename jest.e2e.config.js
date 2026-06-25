/* eslint-disable no-undef */
'use strict';
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.spec.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/fixtures/',
    '/tests/e2e/dashboard-playwright.spec.js', // run via playwright directly
    '/tests/e2e/agent-spec-plan-download.spec.js', // playwright — run via npx playwright test
    '/tests/e2e/dashboard-hierarchy.spec.js', // playwright — run via npx playwright test
  ],
  testTimeout: 120000,
  // No coverage — e2e tests exercise integration paths, not line coverage
};
