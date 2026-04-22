/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/../../tests/unit/**/*.test.ts',
    '<rootDir>/../../tests/integration/**/*.test.ts',
  ],
  moduleNameMapper: {
    '^@randocours/shared(.*)$': '<rootDir>/../../packages/shared/src$1',
    '^@randocours/db(.*)$': '<rootDir>/../../packages/db$1',
  },
  setupFilesAfterFramework: [],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
};
