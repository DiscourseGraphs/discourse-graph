import { config } from "@repo/eslint-config/react-internal";

export default [
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
