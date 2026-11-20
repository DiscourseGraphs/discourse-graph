import { config } from "@repo/eslint-config/react-internal";

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
  },
  {
    // Not an in-file directive: Obsidian's scanner doesn't load preferArrows, so naming it errors ("rule not found").
    // Ported tldraw code; converting its hoisted functions breaks load order (omitFromStackTrace).
    files: ["src/components/canvas/utils/relationUtils.tsx"],
    rules: { "preferArrows/prefer-arrow-functions": "off" },
  },
];
