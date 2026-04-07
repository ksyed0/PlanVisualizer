'use strict';

const js = require('@eslint/js');

const commonGlobals = {
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
};

const commonRules = {
  'no-unused-vars': 'warn',
  'no-console': 'off',
  eqeqeq: 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-undef': 'error',
};

module.exports = [
  {
    ignores: ['eslint.config.js', 'jest.config.js', '.claude/**'],
  },
  js.configs.recommended,
  {
    files: ['tools/**/*.js', 'orchestrator/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: commonGlobals },
    rules: commonRules,
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...commonGlobals,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
    rules: commonRules,
  },
];
