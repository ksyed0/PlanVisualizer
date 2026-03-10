// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js'],
  collectCoverageFrom: ['tools/lib/**/*.js'],
  coverageReporters: ['text', 'lcov', 'json-summary'],
};
