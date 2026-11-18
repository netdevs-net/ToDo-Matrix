import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `.claude/worktrees` holds checkouts of other branches of this same repo,
  // so linting it reports another branch's files as errors in this one.
  { ignores: ['dist', 'node_modules', '.claude'] },

  // Browser code.
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Test files run under Node, and destructure away fields they mean to drop.
  {
    files: ['**/*.test.{ts,tsx,js}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },

  // Browser-console diagnostics: pasted into DevTools, so browser globals and
  // no module system.
  {
    extends: [js.configs.recommended],
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: globals.browser,
    },
  },

  // The Express server and the build config: Node, plain JS.
  {
    extends: [js.configs.recommended],
    files: ['server.js', 'server/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Express decides a handler is an error handler by its arity, so the
      // fourth parameter has to stay even though it is never called.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  }
);
