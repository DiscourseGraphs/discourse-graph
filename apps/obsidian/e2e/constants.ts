import fs from "fs";
import path from "path";

type PluginManifest = {
  id: string;
  name: string;
};

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf-8"),
) as PluginManifest;

export const PLUGIN_ID = manifest.id;
export const PLUGIN_NAME = manifest.name;
export const CREATE_NODE_COMMAND_ID = "create-discourse-node";
export const CREATE_NODE_PALETTE_LABEL = `${PLUGIN_NAME}: Create discourse node`;
export const QUESTION_NODE_PREFIX = "QUE - ";
export const PLUGIN_BUILD_FILES = [
  "main.js",
  "manifest.json",
  "styles.css",
] as const;
export const E2E_TIMEOUT = 10_000;
