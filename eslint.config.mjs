import { fixupConfigRules } from '@eslint/compat';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import react from 'eslint-plugin-react';
import reactCompiler from 'eslint-plugin-react-compiler';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: [
      'public/**',
      'node_modules/**',
      'app/javascript/packs/generated/**',
      'app/javascript/generated/**',
    ],
  },
  js.configs.recommended,
  ...typescriptEslint.configs['flat/recommended'],
  ...fixupConfigRules(react.configs.flat.recommended),
  ...fixupConfigRules(react.configs.flat['jsx-runtime']),
  reactHooks.configs.flat.recommended,
  reactCompiler.configs.recommended,
  {
    files: ['app/javascript/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // Existing demo/RSC boundary code intentionally keeps legacy React imports
      // and loose payload types; keep the first lint gate focused on new issues.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^(_|React$)' },
      ],
      'react/no-unescaped-entities': 'off',
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'error',
      'react-compiler/react-compiler': 'error',
    },
  },
  {
    files: ['e2e/**/*.{js,mjs,ts,mts}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
