import { config } from "@repo/eslint-config/react-internal";

// console.log(config.map((x)=>(x.languageOptions || {}).parserOptions));

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
