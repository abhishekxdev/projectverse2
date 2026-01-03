module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/tests/**/*.test.ts'],
  clearMocks: true,
  coverageDirectory: 'coverage',

  // E2E test configuration
  globalSetup: '<rootDir>/tests/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.ts',
  testTimeout: 30000,
  maxWorkers: 1,

  // Force exit after tests complete (handles Firebase connections)
  forceExit: true,

  // for more control -> setupFilesAfterEnv
  setupFilesAfterEnv: ['<rootDir>/tests/setup/setupTests.ts'],
};
