/**
 * Runtime stand-in for the `obsidian` package, aliased in vitest.config.mts.
 * The real package ships types with no runtime entry point, so a value import
 * needs an implementation here before the module under test will load.
 *
 * obsidianStub.conformance.ts holds each member to its section below. See
 * "Keeping the stub honest" in AGENTS.md before adding one.
 */

import type {
  Debouncer,
  FileStats,
  TFolder as ObsidianTFolder,
  Vault,
} from "obsidian";

/**
 * Fields Obsidian fills from a live vault or the DOM. `null` is falsy, so a
 * guarded path (`if (el)`, `el ?? fallback`) silently takes the absent branch
 * and passes for the wrong reason. Never assert on one; use a real double.
 */
const absent = <T>(): T => null as unknown as T;

// --- Conformant ------------------------------------------------------------

export class TAbstractFile {
  vault: Vault = absent<Vault>();
  path = "";
  name = "";
  parent: ObsidianTFolder | null = null;
}

export class TFile extends TAbstractFile {
  stat: FileStats = { ctime: 0, mtime: 0, size: 0 };
  basename = "";
  extension = "md";
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  /** Obsidian decides this by path, not by parent, so a default folder is not root. */
  isRoot(): boolean {
    return this.path === "/";
  }
}

export class Notice {
  noticeEl = absent<HTMLElement>();
  containerEl = absent<HTMLElement>();
  messageEl = absent<HTMLElement>();
  /** Not on the real class; the stub keeps these so a test can read what was shown. */
  shownMessage: string | DocumentFragment;
  shownDuration: number | undefined;

  constructor(message: string | DocumentFragment, duration?: number) {
    this.shownMessage = message;
    this.shownDuration = duration;
  }

  setMessage(message: string | DocumentFragment): this {
    this.shownMessage = message;
    return this;
  }

  hide(): void {}
}

export const Platform = {
  isDesktop: true,
  isMobile: false,
  isDesktopApp: true,
  isMobileApp: false,
  isIosApp: false,
  isAndroidApp: false,
  isPhone: false,
  isTablet: false,
  isMacOS: true,
  isWin: false,
  isLinux: false,
  isSafari: false,
  resourcePathPrefix: "app://obsidian-stub/",
};

/** Built from a string: Prettier rewrites these escapes in a regex literal into the invisible characters. */
const NBSP_RE = new RegExp("[\\u00A0\\u202F]", "g");

/**
 * Mirrors Obsidian's four steps in order. Stripping slashes empties a root
 * path, which is why "" becomes "/", and there is deliberately no trim.
 */
export const normalizePath = (path: string): string => {
  const stripped = path.replace(/([\\/])+/g, "/").replace(/(^\/+|\/+$)/g, "");
  return (stripped === "" ? "/" : stripped)
    .replace(NBSP_RE, " ")
    .normalize("NFC");
};

export const parseLinktext = (
  linktext: string,
): { path: string; subpath: string } => {
  const hashIndex = linktext.indexOf("#");
  if (hashIndex < 0) return { path: linktext, subpath: "" };
  return {
    path: linktext.slice(0, hashIndex),
    subpath: linktext.slice(hashIndex),
  };
};

export const setIcon = (): void => {};
export const setTooltip = (): void => {};

/**
 * Collapses the delay: the callback runs on every call. Nothing is ever
 * pending, so `run()` flushes nothing and `cancel()` cancels nothing. A test
 * that needs real timing should fake timers instead.
 */
export const debounce = <T extends unknown[], V>(
  cb: (...args: [...T]) => V,
): Debouncer<T, V> => {
  const debouncer = ((...args: [...T]) => {
    cb(...args);
    return debouncer;
  }) as Debouncer<T, V>;
  debouncer.cancel = () => debouncer;
  debouncer.run = () => undefined;
  return debouncer;
};

// --- Shells ----------------------------------------------------------------

export class Events {}
export class Component {}
export class Modal {}
export class Plugin {}
export class SuggestModal {}
export class PluginSettingTab {}
