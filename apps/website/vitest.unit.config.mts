import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
});
