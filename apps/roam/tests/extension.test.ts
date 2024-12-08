import { test, expect } from "@playwright/test";
import root from "../src";

const extensionSettings: Record<string, unknown> = {};
const commandPalette: Record<string, () => unknown> = {};

// TODO - solve playwright's horrendous file resolution
test.skip("End to end flow of Query Builder & Discourse Graphs", () => {
  if (!root) throw new Error("Root not found");
  const { onload } = root;
  const unload = onload({
    extension: {
      version: "test",
    },
    extensionAPI: {
      settings: {
        get: (key: string) => extensionSettings[key],
        getAll: () => extensionSettings,
        set: async (key: string, value: unknown) => {
          extensionSettings[key] = value;
        },
        panel: {
          create: (config) => {},
        },
      },
      ui: {
        commandPalette: {
          addCommand: async (config) => {
            commandPalette[config.label] = config.callback;
          },
          removeCommand: async (config) => {
            delete commandPalette[config.label];
          },
        },
      },
    },
  });
  expect(unload).toBeTruthy();
});
