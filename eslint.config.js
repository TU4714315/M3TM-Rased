import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', '*.d.ts', '*.js.map'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        Response: 'readonly',
        DOMException: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        Response: 'readonly',
        DOMException: 'readonly',
      },
    },
  },
  eslintConfigPrettier,
);
