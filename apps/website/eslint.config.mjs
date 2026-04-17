import { nextJsConfig } from "@repo/eslint-config/next-js";

export default [
  ...nextJsConfig,
  // additions
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
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
  {
    ignores: [".next/**", "public/_pagefind/**"],
  },
];
