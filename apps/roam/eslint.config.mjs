import { config } from "@repo/eslint-config/react-internal";

// console.log(config.map((x)=>(x.languageOptions || {}).parserOptions));

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
];
