import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReact from "eslint-plugin-react";
import globals from "globals";
import { config as baseConfig } from "./base.js";

import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

// this could just be import.meta.dirname if we set minimun node to 20.11
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * A custom ESLint configuration for libraries that use React.
 *
 * @type {import("eslint").Linter.Config[]} */
export const config = [
  ...baseConfig,
  pluginReact.configs.flat.recommended,
  {
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      "react/react-in-jsx-scope": "off",
    },
  },

  // additions
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
