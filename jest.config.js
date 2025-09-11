/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        target: 'ES2020',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        jsx: 'react-jsx',
      }
    }]
  },
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@assets/(.*)$': '<rootDir>/attached_assets/$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(wouter|@tanstack/react-query|msw|regexparam|@jest/globals)/)',
  ],
  collectCoverageFrom: [
    'server/**/*.{ts,js}',
    'shared/**/*.{ts,js}',
    'client/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!server/vite.ts',
    '!**/*.config.{js,ts}'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testTimeout: 8000,
  verbose: false,
  maxWorkers: 1,
  detectOpenHandles: true,
  forceExit: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};