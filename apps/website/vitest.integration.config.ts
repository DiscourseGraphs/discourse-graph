import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    exclude: ["scripts/**"],
    setupFiles: ["test/setup.integration.ts"],
    sequence: { concurrent: false },
    pool: "forks",
    maxWorkers: 1,
    tags: [
      {
        name: "database",
        description: "Tests requiring the database",
      },
    ],
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "app"),
    },
  },
});
