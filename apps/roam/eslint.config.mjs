import base from "@repo/eslint-config/react-internal.js";

export default [
  ...base,
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
    ignores: ["scripts/*.ts"],
  },
];
