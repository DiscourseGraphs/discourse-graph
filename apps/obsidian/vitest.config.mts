import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const obsidianSrc = path.resolve(dirname, "src");
const roamSrc = path.resolve(dirname, "../roam/src");

const resolveAppAlias = (): Plugin => ({
  name: "resolve-app-alias",
  enforce: "pre",
  resolveId(source, importer) {
    if (!source.startsWith("~/")) return null;
    const appSrc = importer?.startsWith(`${roamSrc}/`) ? roamSrc : obsidianSrc;
    return this.resolve(path.join(appSrc, source.slice(2)), importer, {
      skipSelf: true,
    });
  },
});

export default defineConfig({
  plugins: [resolveAppAlias()],
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.{ts,mjs}", "test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "roamjs-components": path.resolve(
        dirname,
        "../roam/node_modules/roamjs-components",
      ),
      // `obsidian` ships types only, so a value import fails to resolve here.
      obsidian: path.resolve(dirname, "test/obsidianStub.ts"),
    },
  },
});
