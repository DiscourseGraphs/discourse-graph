import js from "@eslint/js";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReact from "eslint-plugin-react";
import globals from "globals";
import pluginNext from "@next/eslint-plugin-next";
import { config as baseConfig } from "./base.js";

import vercel from "@vercel/style-guide/eslint/next";
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "url";
import path from "path";

// this could just be import.meta.dirname if we set minimun node to 20.11
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * A custom ESLint configuration for libraries that use Next.js.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const nextJsConfig = [
  ...baseConfig,
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    plugins: {
      "@next/next": pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
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
  ...compat.config(vercel),
  ...compat.extends("eslint-config-turbo"),
  ...compat.config(pluginNext.configs["core-web-vitals"]),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        React: true,
        JSX: true,
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
  },
];
