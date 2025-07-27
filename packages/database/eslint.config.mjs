import { config as base } from "@repo/eslint-config/react-internal";

export default [
  ...base,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: ".",
        project: "./tsconfig.json",
      },
    },
  },
  {
    ignores: ["types.gen.ts", "supabase/functions/**"],
  },
];
