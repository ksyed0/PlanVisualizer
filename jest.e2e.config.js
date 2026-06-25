/* eslint-disable no-undef */
'use strict';
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.spec.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/fixtures/'],
  testTimeout: 120000,
  // No coverage — e2e tests exercise integration paths, not line coverage
};
