import { config } from "@repo/eslint-config/react-internal";
import scannerConfig from "@repo/eslint-config/obsidian-scanner";

// Merged last-wins like ESLint does; per-block `files` is ignored, which holds while
// every escalation targets TypeScript.
const scannerRules = Object.assign(
  {},
  ...scannerConfig.map((block) => block.rules ?? {}),
);
const scannerPlugins = Object.assign(
  {},
  ...scannerConfig.map((block) => block.plugins ?? {}),
);
const severityOf = (value) => (Array.isArray(value) ? value[0] : value);

// The rules that block an Obsidian submission, so editors surface them.
const blockingRules = Object.fromEntries(
  Object.entries(scannerRules).filter(([, value]) =>
    ["error", 2].includes(severityOf(value)),
  ),
);
// Taken from the scanner config, so the editor runs the same plugin instances.
const blockingPlugins = Object.fromEntries(
  Object.keys(blockingRules)
    .filter((rule) => rule.includes("/"))
    .map((rule) => rule.split("/")[0])
    .map((name) => [name, scannerPlugins[name]]),
);

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
    plugins: blockingPlugins,
    rules: blockingRules,
  },
];
