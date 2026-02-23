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
    ignores: ['eslint.config.{js,cjs,mjs}'],
  },
  ...feedicFlatConfig,
  {
    rules: {
        "no-constant-binary-expression": 2,
        "unicorn/no-array-callback-reference": 0,
        "unicorn/no-array-reduce": 0,
        "unicorn/prevent-abbreviations": 0
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
      "dot-notation": 0,
    },
  },
  eslintConfigBiome
]);
