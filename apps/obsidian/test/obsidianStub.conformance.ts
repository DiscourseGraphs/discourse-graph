/**
 * Compile-time check that test/obsidianStub.ts still matches the `obsidian`
 * package. Nothing here runs: only `pnpm check-types` enforces it, never
 * `test:unit`. Shells are checked by name alone because conforming them in
 * full would mean reproducing a large class surface for no test value.
 *
 * See "Keeping the stub honest" in AGENTS.md.
 */

import type * as ObsidianApi from "obsidian";
import * as stub from "./obsidianStub";

// --- Conformant: full type compatibility ------------------------------------

const conformant = {
  TAbstractFile: stub.TAbstractFile satisfies typeof ObsidianApi.TAbstractFile,
  TFile: stub.TFile satisfies typeof ObsidianApi.TFile,
  TFolder: stub.TFolder satisfies typeof ObsidianApi.TFolder,
  Notice: stub.Notice satisfies typeof ObsidianApi.Notice,
  Platform: stub.Platform satisfies typeof ObsidianApi.Platform,
  normalizePath: stub.normalizePath satisfies typeof ObsidianApi.normalizePath,
  parseLinktext: stub.parseLinktext satisfies typeof ObsidianApi.parseLinktext,
  setIcon: stub.setIcon satisfies typeof ObsidianApi.setIcon,
  setTooltip: stub.setTooltip satisfies typeof ObsidianApi.setTooltip,
  debounce: stub.debounce satisfies typeof ObsidianApi.debounce,
};

// --- Shells: the export name must still exist upstream ----------------------

type ShellName = keyof typeof ObsidianApi &
  (
    | "Events"
    | "Component"
    | "Modal"
    | "Plugin"
    | "SuggestModal"
    | "PluginSettingTab"
  );

/** Constructible, so a shell cannot quietly become something that is not a class. */
type Shell = abstract new (...args: never[]) => unknown;

/**
 * Indexed by export name, not `Record<ShellName, Shell>`: that form lets a
 * deleted shell pass unnoticed when another export is wired into its slot.
 */
const shells: { [K in ShellName]: (typeof stub)[K] & Shell } = {
  Events: stub.Events satisfies Shell,
  Component: stub.Component satisfies Shell,
  Modal: stub.Modal satisfies Shell,
  Plugin: stub.Plugin satisfies Shell,
  SuggestModal: stub.SuggestModal satisfies Shell,
  PluginSettingTab: stub.PluginSettingTab satisfies Shell,
};

// --- Completeness: every stub export is classified above ---------------------

type Classified = keyof typeof conformant | keyof typeof shells;
type Unclassified = Exclude<keyof typeof stub, Classified>;

const allClassified: Unclassified extends never
  ? true
  : [
      "classify these stub exports in obsidianStub.conformance.ts:",
      Unclassified,
    ] = true;

void conformant;
void shells;
void allClassified;
