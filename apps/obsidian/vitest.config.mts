import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts", "test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "~": path.resolve(dirname, "src"),
      // `obsidian` ships types only, so a value import fails to resolve here.
      obsidian: path.resolve(dirname, "test/obsidianStub.ts"),
    },
  },
});
