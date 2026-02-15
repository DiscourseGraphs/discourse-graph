// tailwind config is required for editor support

import type { Config } from "tailwindcss";
import sharedConfig from "@repo/tailwind-config";

const config: Pick<Config, "content" | "presets" | "darkMode"> = {
  content: [],
  presets: [sharedConfig],
  darkMode: ["class", ".bp3-dark"],
};

export default config;
