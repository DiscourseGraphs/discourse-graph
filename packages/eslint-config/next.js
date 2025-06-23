import { resolve } from "node:path";
import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import tseslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-config-prettier";
import turbo from "eslint-plugin-turbo";
import onlyWarn from "eslint-plugin-only-warn";
import vercel from "@vercel/style-guide/eslint/next";
import globals from "globals";
import next_eslint from "@next/eslint-plugin-next";

const project = resolve(process.cwd(), "tsconfig.json");

// this could just be import.meta.dirname if we set minimun node to 20.11
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/*
 * This is a custom ESLint configuration for use within vercel
 */

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  ...tseslint.configs["flat/recommended-type-checked"],
  prettier,
  ...compat.config(vercel),
  ...compat.extends("eslint-config-turbo"),
  ...compat.config(next_eslint.configs["core-web-vitals"]),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        React: true,
        JSX: true,
      },
      parserOptions: {
        project: true,
        tsconfigRootDir: path.dirname(project),
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: { "only-warn": onlyWarn },
    settings: {
      "import/resolver": {
        typescript: {
          project,
        },
      },
    },
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
      "*.config.*",
    ],
  },
];
