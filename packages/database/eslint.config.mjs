import { config as base } from "@repo/eslint-config/react-internal";

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
    ignores: ["types.gen.ts", "supabase/functions/**"],
  },
];
