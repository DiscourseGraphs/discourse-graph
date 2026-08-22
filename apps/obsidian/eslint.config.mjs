import { config } from "@repo/eslint-config/react-internal";
import { storeRules } from "@repo/eslint-config/obsidian-store";
import obsidianmd from "eslint-plugin-obsidianmd";

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
    // Store blockers only, so they show up in the editor. Registering the rules
    // rather than obsidianmd's recommended config keeps its JSON language setup out.
    plugins: { obsidianmd },
    rules: storeRules,
  },
];
