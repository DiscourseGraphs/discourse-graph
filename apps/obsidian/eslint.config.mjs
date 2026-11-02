import { config } from "@repo/eslint-config/react-internal";
import scannerConfig from "@repo/eslint-config/obsidian-scanner";

// Merged last-wins like ESLint does; per-block `files` is dropped, which holds while
// every escalation targets TypeScript. Global ignores are kept below.
const scannerRules = Object.assign(
  {},
  ...scannerConfig.map((block) => block.rules ?? {}),
);
const scannerPlugins = Object.assign(
  {},
  ...scannerConfig.map((block) => block.plugins ?? {}),
);
// Paths the scanner never lints (scripts, tests, mocks), from its ignores-only blocks.
const scannerIgnores = scannerConfig
  .filter((block) =>
    Object.keys(block).every((key) => ["name", "ignores"].includes(key)),
  )
  .flatMap((block) => block.ignores);
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
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: scannerIgnores,
    plugins: blockingPlugins,
    rules: blockingRules,
  },
];
