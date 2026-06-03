import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Next.js (core-web-vitals + typescript) baseline, extended with the
// portfolio's hand-tuned quality rules. Type-aware rules (no-floating-promises)
// are added once a logic layer + project-service parsing is in place.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Tests, scripts, and the Node pipeline may log freely and use any.
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.vitest.test.{ts,tsx}',
      'scripts/**/*.ts',
      'pipeline/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'docs/**',
    '.agents/**',
  ]),
]);

export default eslintConfig;
