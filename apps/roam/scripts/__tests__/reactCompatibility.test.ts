import esbuild from "esbuild";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { importAsGlobals } from "../importAsGlobals";

type Fixture = {
  react: Record<string, unknown>;
  renderer: object;
  read: () => number;
  getHook: () => unknown;
};

const buildFixture = async (): Promise<string> => {
  const result = await esbuild.build({
    bundle: true,
    stdin: {
      contents: `
            import React, { useSyncExternalStore } from "react";
            import ReactDOM from "react-dom";
            export const react = React;
            export const renderer = ReactDOM;
            export const getHook = () => useSyncExternalStore;
            export const read = () => useSyncExternalStore(() => () => {}, () => 42);
          `,
      resolveDir: process.cwd(),
    },
    format: "cjs",
    write: false,
    sourcemap: false,
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      importAsGlobals({
        react: "./scripts/react.cjs",
        "react-dom": "window.ReactDOM",
      }),
    ],
  });
  return result.outputFiles?.[0]?.text || "";
};

describe("Roam React compatibility bundle", () => {
  it.each([false, true])(
    "keeps the host renderer and a private hook when a global shim already exists: %s",
    async (hasExistingShim): Promise<void> => {
      const existingShim = vi.fn(() => -1);
      const useState = vi.fn((value: unknown) => [value, vi.fn()]);
      const dispatcher = {};
      const hostReact = {
        useState,
        useEffect: vi.fn(),
        useLayoutEffect: vi.fn(),
        useDebugValue: vi.fn(),
        createElement: vi.fn(),
        __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: dispatcher,
        ...(hasExistingShim ? { useSyncExternalStore: existingShim } : {}),
      };
      const renderer = {};
      const module = { exports: {} as Fixture };
      runInNewContext(await buildFixture(), {
        module,
        exports: module.exports,
        window: {
          React: hostReact,
          ReactDOM: renderer,
          document: { createElement: vi.fn() },
        },
      });
      const fixture = module.exports;
      const privateHook = fixture.getHook();

      expect(fixture.react).not.toBe(hostReact);
      expect(fixture.react.useState).toBe(hostReact.useState);
      expect(fixture.react.createElement).toBe(hostReact.createElement);
      expect(
        fixture.react.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
      ).toBe(dispatcher);
      expect(fixture.renderer).toBe(renderer);
      expect(hostReact.useSyncExternalStore).toBe(
        hasExistingShim ? existingShim : undefined,
      );
      expect(privateHook).not.toBe(existingShim);
      expect(fixture.read()).toBe(42);
      expect(useState).toHaveBeenCalledTimes(1);

      // Simulate another extension loading between component renders.
      const replacement = vi.fn(() => -2);
      hostReact.useSyncExternalStore = replacement;
      expect(fixture.getHook()).toBe(privateHook);
      expect(fixture.read()).toBe(42);
      expect(useState).toHaveBeenCalledTimes(2);
      expect(existingShim).not.toHaveBeenCalled();
      expect(replacement).not.toHaveBeenCalled();
    },
  );
});
