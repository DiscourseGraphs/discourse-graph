import { config } from "@repo/eslint-config/obsidian-store";

export default [
  ...config,
  {
    // Build and test-data tooling never ships in the plugin bundle, so Obsidian never reviews it.
    ignores: ["scripts/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: true,
        ecmaFeatures: { jsx: true },
      },
    },
  },
];
