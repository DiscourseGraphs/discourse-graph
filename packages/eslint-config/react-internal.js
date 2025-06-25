import { resolve } from "node:path";
import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import tseslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-config-prettier";
import onlyWarn from "eslint-plugin-only-warn";
import globals from "globals";

// this could just be import.meta.dirname if we set minimun node to 20.11
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/*
 * This is a custom ESLint configuration for use with
 * internal (bundled by their consumer) libraries
 * that utilize React.
 */

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  ...tseslint.configs["flat/recommended-type-checked"],
  prettier,
  ...compat.extends("eslint-config-turbo"),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        React: true,
      },
      // IMPORTANT: This is given as an example, but must be repeated in each project. Cwd fails in editors.
      parserOptions: {
        project: true,
        tsconfigRootDir: ".",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: { "only-warn": onlyWarn },
    settings: {
      "import/resolver": {
        typescript: {
          project: "tsconfig.lint.json",
        },
      },
    },
    // Force ESLint to detect .tsx files
    files: ["**/*.ts?(x)", "**/*.js?(x)"],
  },
  {
    files: ["**/*.js?(x)", "**/*.mjs"],
    ...tseslint.configs["flat/disable-type-checked"],
  },
  {
    ignores: [
      // Ignore dotfiles
      ".*.js",
      "node_modules/",
      "dist/",
      "*.config.*",
    ],
  },
];
