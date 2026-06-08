// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],
  // BUG-0265: testMatch's leading `**/` also matches nested git worktrees under
  // .claude/worktrees/<name>/tests/**, so jest scans phantom test files from
  // stale worktrees (whose node_modules are gone -> MODULE_NOT_FOUND failures).
  // Exclude .claude/ from both test discovery and Haste module resolution.
  testPathIgnorePatterns: ['/node_modules/', '/\\.claude/'],
  modulePathIgnorePatterns: ['/\\.claude/'],
  collectCoverageFrom: ['tools/lib/**/*.js'],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 70,
      functions: 80,
      statements: 80,
    },
  },
};
