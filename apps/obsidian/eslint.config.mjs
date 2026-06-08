import { config } from "@repo/eslint-config/react-internal";

export default [
  {
    ignores: ["e2e/html-report/**", "e2e/test-results/**"],
  },
  ...config,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: ".",
        project: true,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ["e2e/**/*.ts"],
    rules: {
      // Playwright fixtures use `use` and worker fixtures omit deps — not React hooks
      "react-hooks/rules-of-hooks": "off",
      "no-empty-pattern": "off",
    },
  },
];
