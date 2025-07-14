import base from "@repo/eslint-config/react-internal";

export default [
  ...base,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: ".",
      },
    },
  }
];
