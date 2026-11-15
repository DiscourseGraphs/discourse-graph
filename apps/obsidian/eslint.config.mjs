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
    // Copied from tldraw's arrow code, which uses function declarations throughout.
    files: ["src/components/canvas/utils/relationUtils.tsx"],
    rules: { "preferArrows/prefer-arrow-functions": "off" },
  },
];
