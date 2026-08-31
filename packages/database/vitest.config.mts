import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["dist/**"],
    include: ["src/**/*.test.ts"],
  },
});
