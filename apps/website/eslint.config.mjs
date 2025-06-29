import base from "@repo/eslint-config/next.js";

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
    ignores: [".next/**"],
  },
];


