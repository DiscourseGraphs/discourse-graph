import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["src/utils/__tests__/mocks/importNodes.ts"],
    include: ["src/utils/__tests__/**/*.test.{ts,mjs}"],
  },
  resolve: {
    alias: {
      "~": path.resolve(dirname, "src"),
      "roamjs-components": path.resolve(
        dirname,
        "../roam/node_modules/roamjs-components",
      ),
      obsidian: path.resolve(dirname, "src/utils/__tests__/mocks/obsidian.ts"),
    },
  },
});
