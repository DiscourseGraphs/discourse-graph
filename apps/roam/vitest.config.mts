import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["src/utils/__tests__/setup.ts"],
    include: [
      "src/utils/__tests__/**/*.test.ts",
      "scripts/__tests__/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "~": path.resolve(dirname, "src"),
    },
  },
});
