/** Unit tests only: no database, no S3. See tests/README section in backend-lambda/README.md */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  clearMocks: true,
  reporters: ['default', '<rootDir>/tests/reporters/table-reporter.cjs'],
};
