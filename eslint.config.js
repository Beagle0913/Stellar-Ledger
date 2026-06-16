// Flat ESLint config (CommonJS, since the package is not "type": "module").
// Pragmatic ruleset: typescript-eslint recommended + React hooks rules, with
// allowances for the codebase's established patterns (non-null assertions in
// tests, `_`-prefixed intentionally-unused parameters).
const tseslint = require('typescript-eslint')
const reactHooks = require('eslint-plugin-react-hooks')

module.exports = tseslint.config(
  {
    ignores: ['out/**', 'release/**', 'node_modules/**', '*.config.*', 'saves/**']
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ]
    }
  },
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../simulation/*', '../simulation/**'], message: 'shared must not import simulation' },
            { group: ['../database/*', '../database/**'], message: 'shared must not import database' },
            { group: ['../main/*', '../main/**'], message: 'shared must not import main' },
            { group: ['../renderer/*', '../renderer/**'], message: 'shared must not import renderer' },
            { group: ['../mods/*', '../mods/**'], message: 'shared must not import mods' }
          ]
        }
      ]
    }
  },
  {
    files: ['src/simulation/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../database/*', '../database/**'], message: 'simulation must not import database' },
            { group: ['../main/*', '../main/**'], message: 'simulation must not import main' },
            { group: ['../renderer/*', '../renderer/**'], message: 'simulation must not import renderer' },
            { group: ['../mods/*', '../mods/**'], message: 'simulation must not import mods' }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../simulation/*', '../simulation/**'], message: 'renderer must not import simulation' },
            { group: ['../database/*', '../database/**'], message: 'renderer must not import database' },
            { group: ['../main/*', '../main/**'], message: 'renderer must not import main' },
            { group: ['../mods/*', '../mods/**'], message: 'renderer must not import mods' }
          ]
        }
      ]
    }
  }
)
