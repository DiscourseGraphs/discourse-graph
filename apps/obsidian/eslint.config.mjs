import { config } from "@repo/eslint-config/react-internal";
import obsidianmd from "eslint-plugin-obsidianmd";

const languageOptions = {
  parserOptions: {
    tsconfigRootDir: ".",
    project: true,
    ecmaFeatures: {
      jsx: true,
    },
  },
};

/**
 * The monorepo-wide rules, and the lane that gates merges: CI lints changed files
 * against this lane alone, so a violation on an added line fails the PR check.
 */
export const blocking = [...config, { languageOptions }];

// Only obsidianmd/* rules are taken from the recommended preset. Spreading the preset
// whole also registers typescript-eslint, import, depend and @microsoft/sdl, which
// would duplicate and conflict with the rules already in the blocking lane.
const obsidianmdRules = Object.fromEntries(
  obsidianmd.configs.recommended
    .flatMap((c) => Object.entries(c.rules ?? {}))
    .filter(([key]) => key.startsWith("obsidianmd/")),
);

const obsidianmdLane = {
  plugins: { obsidianmd },
  rules: {
    ...obsidianmdRules,
    "obsidianmd/prefer-active-doc": "off",
    "obsidianmd/prefer-file-manager-trash-file": "off",
  },
};

/**
 * Obsidian plugin store rules, reported everywhere but never merge-blocking. CI runs
 * this lane separately and annotates violations on changed lines without failing the
 * check. These rules flag store review risks, which are worth seeing while editing but
 * are not a reason to hold up an unrelated change.
 *
 * Standalone, the lane reuses the shared preset with its rules stripped out. That keeps
 * one parser, one set of globals and one set of ignores across both lanes — importing a
 * second parser here would mix the shared preset's typescript-eslint 7 rules with an
 * AST built by the typescript-eslint 8 that apps/obsidian resolves.
 */
export const advisory = [
  ...config
    .map(({ rules: _rules, ...rest }) => rest)
    .filter((entry) => Object.keys(entry).length > 0),
  { languageOptions },
  // With the monorepo rules stripped, every eslint-disable comment aimed at them looks
  // unused. Those reports belong to the blocking lane, not here.
  { linterOptions: { reportUnusedDisableDirectives: "off" } },
  obsidianmdLane,
];

/**
 * What the IDE and `pnpm lint` use: both lanes together, so Obsidian plugin store
 * issues show up while editing.
 */
export default [...blocking, obsidianmdLane];
