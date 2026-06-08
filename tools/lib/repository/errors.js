'use strict';

class ValidationError extends Error {
  constructor(message, { code = 'VALIDATION', details = {} } = {}) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
  }
  toJSON() {
    return { name: this.name, message: this.message, code: this.code, details: this.details };
  }
}

class SerializerStabilityError extends Error {
  constructor(message, { pass1 = '', pass2 = '', diffPath = '' } = {}) {
    super(message);
    this.name = 'SerializerStabilityError';
    this.pass1 = pass1;
    this.pass2 = pass2;
    this.diffPath = diffPath;
  }
}

module.exports = { ValidationError, SerializerStabilityError };
