import obsidianmd from "eslint-plugin-obsidianmd";
import preferArrows from "eslint-plugin-prefer-arrow-functions";
import pluginReactHooks from "eslint-plugin-react-hooks";
import turboPlugin from "eslint-plugin-turbo";

// Obsidian community plugin store compliance gate: everything it reports can get the plugin pulled from the store.
// Deliberately not built on ./base.js — that loads eslint-plugin-only-warn, which patches ESLint on import and forces every rule to "warn".
// Must run in its own process (see `lint:store`) so a normal lint run's only-warn patch cannot leak in.

const severityOf = (value) => (Array.isArray(value) ? value[0] : value);
const isError = (value) =>
  severityOf(value) === "error" || severityOf(value) === 2;

// obsidianmd's recommended set mixes store blockers (error) with style advice (warn); keep only its own error-level rules.
const storeRules = {};
for (const block of obsidianmd.configs.recommended) {
  if (!block.rules) continue;
  for (const [rule, value] of Object.entries(block.rules)) {
    if (rule.startsWith("obsidianmd/") && isError(value)) {
      storeRules[rule] = value;
    }
  }
}

/** @type {import("eslint").Linter.Config[]} */
export const config = [
  { ignores: ["dist/**", "node_modules/**", "*.config.*"] },
  // Language/plugin setup from the recommended set, without its rule severities.
  ...obsidianmd.configs.recommended.filter((block) => !block.rules),
  {
    // Registered only so existing `eslint-disable` comments naming these rules don't error as "Definition for rule not found".
    plugins: { preferArrows, "react-hooks": pluginReactHooks, turboPlugin },
  },
  {
    files: ["**/*.{ts,tsx}"],
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      ...storeRules,
      // The recommended set's globals don't know about the JSX runtime, and type-aware linting already covers this.
      "no-undef": "off",
    },
  },
];
