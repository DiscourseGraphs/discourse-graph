import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

// Mirrors the Obsidian community directory scanner, whose errors block a submission.
// Ported from obsidianmd/obsidian-workflows src/lint.ts; re-check it when bumping the plugin.

/** The scanner downgrades every rule except eslint-comments/* to a warning. */
const toWarns = (config) => {
  if (!config) return config;
  if (Array.isArray(config)) return config.map(toWarns);
  const result = { ...config };
  // 0.4.1 ships no `extends`, but handle it so a future version doesn't silently skip rules.
  if (Array.isArray(result.extends)) result.extends = toWarns(result.extends);
  if (result.rules) {
    result.rules = Object.fromEntries(
      Object.entries(result.rules).map(([rule, value]) => {
        if (rule.startsWith("eslint-comments/")) return [rule, value];
        if (value === "error" || value === 2) return [rule, "warn"];
        if (Array.isArray(value) && (value[0] === "error" || value[0] === 2)) {
          return [rule, ["warn", ...value.slice(1)]];
        }
        return [rule, value];
      }),
    );
  }
  return result;
};

/** The subset the scanner re-escalates; these are what actually block installability. */
export const errorRules = {
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-unsanitized/method": "error",
  "no-unsanitized/property": "error",
  "obsidianmd/regex-lookbehind": "error",
  "obsidianmd/no-forbidden-elements": "error",
  "obsidianmd/settings-tab/no-manual-html-headings": "error",
  "obsidianmd/settings-tab/no-problematic-settings-headings": "error",
  "obsidianmd/sample-names": "error",
  "obsidianmd/no-sample-code": "error",
  "obsidianmd/platform": "error",
  "obsidianmd/no-plugin-as-component": "error",
  "obsidianmd/detach-leaves": "error",
  "obsidianmd/no-static-styles-assignment": "error",
  "obsidianmd/no-view-references-in-plugin": "error",
  "obsidianmd/no-unsupported-api": "error",
  "eslint-comments/no-unlimited-disable": "error",
  "eslint-comments/require-description": "error",
  "eslint-comments/disable-enable-pair": ["error", { allowWholeFile: false }],
  "eslint-comments/no-restricted-disable": [
    "error",
    "obsidianmd/*",
    "no-console",
  ],
};

// Taken from the recommended set rather than a direct dependency, so the editor
// uses the same plugin instances the scanner does.
const recommendedPlugins = Object.assign(
  {},
  ...obsidianmd.configs.recommended.map((block) => block.plugins ?? {}),
);

if (!recommendedPlugins["eslint-comments"]) {
  throw new Error(
    "eslint-plugin-obsidianmd no longer exposes the eslint-comments plugin; editor rules would silently drop it.",
  );
}

export const errorPlugins = {
  obsidianmd,
  "eslint-comments": recommendedPlugins["eslint-comments"],
};

// errorRules minus rules from plugins the app's main config cannot resolve.
export const editorRules = Object.fromEntries(
  Object.entries(errorRules).filter(
    ([rule]) =>
      rule === "no-eval" ||
      Object.keys(errorPlugins).some((p) => rule.startsWith(`${p}/`)),
  ),
);

export const config = defineConfig([
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "eslint.config.*",
            "manifest.json",
            "postcss.config.js",
          ],
        },
        extraFileExtensions: [".json"],
      },
    },
  },

  ...toWarns(obsidianmd.configs.recommended),

  {
    files: ["**/*.{ts,cts,mts,tsx,js,cjs,mjs,jsx}"],
    linterOptions: {
      noInlineConfig: false,
      reportUnusedDisableDirectives: "off",
      reportUnusedInlineConfigs: "off",
    },
    rules: {
      ...errorRules,
      // Covered by TypeScript, or too noisy for the scanner.
      "no-undef": "off",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "import/no-unresolved": "off",
      // The scanner checks these outside ESLint.
      "obsidianmd/validate-manifest": "off",
      "obsidianmd/validate-license": "off",
      // Existing plugins must not change their command ids.
      "obsidianmd/commands/no-command-in-command-id": "off",
      "obsidianmd/commands/no-plugin-id-in-command-id": "off",
    },
  },

  globalIgnores([
    "node_modules",
    "dist",
    "build",
    "pkg",
    "test-vault",
    ".obsidian",
    "**/.obsidian/**",
    "esbuild.config.mjs",
    "version-bump.mjs",
    "**/*.test.*",
    "**/*.tests.*",
    "**/*.spec.*",
    "**/*.specs.*",
    "**/test/**",
    "**/tests/**",
    "**/__tests__/**",
    "**/mocks/**",
    "**/__mocks__/**",
    "**/*.cjs",
    "**/*.mjs",
    "**/*.cts",
    "**/*.mts",
    "**/vite*",
    "**/scripts/**",
    "**/docs/**",
    "**/i18n/**",
    "**/i18next/**",
    "**/locale/**",
    "**/locales/**",
    "**/translations/**",
    "**/l10n/**",
    ".pnpm-store",
    "**/*.spec.ts",
    "**/testUtils**",
    "automation/**",
    "e2e-tests/**",
  ]),
]);
