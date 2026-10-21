const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores(['dist/**', '.expo/**', 'coverage/**', 'node_modules/**', 'src/api/schema.d.ts']),
  expoConfig,
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            'Call the API through the generated client (src/api). Credentials and tokens must only travel through it.',
        },
      ],
    },
  },
  {
    // The mock API is a development and test tool: production code reaches it only through the client factory,
    // which loads it with a dynamic import when EXPO_PUBLIC_API_MODE=mock.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/mocks/**', 'src/api/createApiClient.ts', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/mocks', '@/mocks/*', '**/mocks', '**/mocks/*'],
              message: 'Only src/api/createApiClient.ts may load the mock API.',
            },
          ],
        },
      ],
    },
  },
  {
    // Tests and the mock API implement fetch, so they may call it directly.
    files: ['src/mocks/**', 'src/**/*.test.{ts,tsx}', 'src/api/createApiClient.ts', 'scripts/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // Build scripts report on the console; Jest setup files load mocks with require.
    files: ['scripts/**', 'jest.setup.ts'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-require-imports': 'off' },
  },
]);
