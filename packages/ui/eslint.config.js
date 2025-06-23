import base from "@repo/eslint-config/react-internal.js";
import parser from "@typescript-eslint/parser";

export default [
  ...base,
  {
    languageOptions: {
      parser,
      parserOptions: {
        project: "./tsconfig.lint.json",
      },
    },
  },
];
