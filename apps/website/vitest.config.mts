import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "app"),
    },
  },
});
