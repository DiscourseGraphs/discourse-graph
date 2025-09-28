import { config as base } from "@repo/eslint-config/base";

export default [
  ...base,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: ".",
      },
    },
  },
  {
    ignores: ["src/dbTypes.ts", "supabase/functions/**"],
  },
];
