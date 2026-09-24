// Resolving a WebSocket implementation without adding a dependency.
//
// Node 22+ ships a global WebSocket. On older Node (this repo runs 20.x) we fall
// back to `ws`, which is present in the pnpm store as a transitive dependency.
// It is resolved rather than imported by path so the scripts work from any
// worktree and on any teammate's machine.
import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const fromPnpmStore = (startDir) => {
  let dir = path.resolve(startDir);
  for (;;) {
    const store = path.join(dir, "node_modules", ".pnpm");
    if (existsSync(store)) {
      const match = readdirSync(store)
        .filter((entry) => entry.startsWith("ws@"))
        .sort()
        .at(-1);
      if (match) {
        const candidate = path.join(
          store,
          match,
          "node_modules",
          "ws",
          "index.js",
        );
        if (existsSync(candidate)) return candidate;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};

export const resolveWebSocket = async ({ from = process.cwd() } = {}) => {
  if (typeof globalThis.WebSocket === "function") return globalThis.WebSocket;

  const require = createRequire(path.join(from, "noop.js"));
  try {
    return require("ws");
  } catch {
    // Not hoisted into a reachable node_modules — look in the pnpm store.
  }

  const storePath = fromPnpmStore(from);
  if (storePath) {
    const loaded = await import(`file://${storePath}`);
    return loaded.default ?? loaded.WebSocket;
  }

  throw new Error(
    "No WebSocket implementation found. Run this from inside the monorepo " +
      "after `pnpm install`, or use Node 22+ which has a global WebSocket.",
  );
};
