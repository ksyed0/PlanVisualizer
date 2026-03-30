'use strict';

const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['tools/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'eqeqeq': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
];
