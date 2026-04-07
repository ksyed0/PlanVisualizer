'use strict';

const { git, branchFiles, checkOverlap } = require('../../orchestrator/git-safe');

describe('git-safe', () => {
  describe('git helper', () => {
    it('runs a git command successfully', () => {
      const result = git('status --short');
      expect(result.ok).toBe(true);
      expect(typeof result.stdout).toBe('string');
    });

    it('returns ok=false for invalid commands', () => {
      const result = git('not-a-real-command');
      expect(result.ok).toBe(false);
      expect(result.stderr).toBeTruthy();
    });

    it('returns current branch', () => {
      const result = git('rev-parse --abbrev-ref HEAD');
      expect(result.ok).toBe(true);
      expect(result.stdout.length).toBeGreaterThan(0);
    });
  });

  describe('branchFiles', () => {
    it('returns an array', () => {
      const files = branchFiles('HEAD', 'HEAD~1');
      expect(Array.isArray(files)).toBe(true);
    });
  });

  describe('checkOverlap', () => {
    it('returns overlap structure', () => {
      const result = checkOverlap('HEAD', 'HEAD', 'HEAD~1');
      expect(result).toHaveProperty('overlapping');
      expect(result).toHaveProperty('files');
      expect(Array.isArray(result.files)).toBe(true);
    });
  });
});
