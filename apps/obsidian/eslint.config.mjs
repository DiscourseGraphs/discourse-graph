import { config } from "@repo/eslint-config/react-internal";
import {
  editorRules,
  errorPlugins,
} from "@repo/eslint-config/obsidian-scanner";

export default [
  ...config,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: true,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    // Only the rules that block installability, so editors surface them.
    plugins: errorPlugins,
    rules: editorRules,
  },
];
