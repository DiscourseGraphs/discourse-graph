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
];
