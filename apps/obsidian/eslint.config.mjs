import { config } from "@repo/eslint-config/react-internal";
import obsidianmd from "eslint-plugin-obsidianmd";

// Extract only obsidianmd/* rules from the recommended config.
// Spreading obsidianmd.configs.recommended directly re-registers @typescript-eslint,
// which conflicts with react-internal. This approach picks up all obsidianmd rules
// (including future additions) without touching the TS plugin registration.
const obsidianmdRules = Object.fromEntries(
  obsidianmd.configs.recommended
    .flatMap((c) => Object.entries(c.rules ?? {}))
    .filter(([key]) => key.startsWith("obsidianmd/")),
);

export default [
  ...config,
  {
    plugins: { obsidianmd },
    rules: {
      ...obsidianmdRules,
      "obsidianmd/prefer-active-doc": "off",
      "obsidianmd/prefer-file-manager-trash-file": "off",
    },
  },
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
