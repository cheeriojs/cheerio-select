import { includeIgnoreFile } from '@eslint/compat';
import feedicFlatConfig from '@feedic/eslint-config';
import { commonTypeScriptRules } from '@feedic/eslint-config/typescript';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import { fileURLToPath } from 'node:url';
import eslintConfigBiome from 'eslint-config-biome';

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url));

export default defineConfig([
  includeIgnoreFile(gitignorePath),
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    ignores: ['eslint.config.{js,cjs,mjs}'],
  },
  ...feedicFlatConfig,
  {
    rules: {
        "no-constant-binary-expression": 2,
        "unicorn/no-array-callback-reference": 0,
        "unicorn/prefer-query-selector": 0,
    },
  },
  {
    files: [
        "**/*.ts"
    ],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
          "sourceType": "module",
          "project": "./tsconfig.eslint.json"
      },
    },
    rules: {
      ...commonTypeScriptRules,
    },
  },
  eslintConfigBiome,
  // Use the Number namespace required by the existing Biome configuration.
  {
    files: ["src/index.ts", "src/positionals.ts"],
    rules: {
      "unicorn/prefer-global-number-constants": "off",
    },
  },

  // These fixtures use domhandler nodes; browser querySelector and firstElementChild APIs do not apply.
  {
    files: ["test/advanced-selectors.spec.ts", "test/sizzle.spec.ts"],
    rules: {
      "unicorn/better-dom-traversing": "off",
    },
  },
]);
