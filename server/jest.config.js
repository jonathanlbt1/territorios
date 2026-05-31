export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  // Look for tests in the tests folder
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js', '**/*.test.mjs'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/db/migrate.js',
    '!src/db/seed.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  // Clear mocks between tests
  clearMocks: true,
  // Restore mocks after each test
  restoreMocks: true,
  // Force exit after tests complete (handles open handles like setInterval)
  forceExit: true,
  // Test timeout
  testTimeout: 10000,
};
