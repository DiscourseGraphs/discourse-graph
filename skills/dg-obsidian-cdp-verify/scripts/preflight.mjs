#!/usr/bin/env node
// Checks the three things that silently invalidate a verification run.
//
//   node preflight.mjs "some string unique to your change"
import { readFileSync, existsSync } from "node:fs";
import { connect, PLUGIN_ID } from "./driver.mjs";

const marker = process.argv[2];
const vault = process.env.VAULT ?? "testVault";
const pluginDir =
  process.env.PLUGIN_DIR ??
  `${process.env.HOME}/Documents/${vault}/.obsidian/plugins/discourse-graphs`;

const report = [];
const note = (ok, text) => {
  report.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"}  ${text}`);
};

// 1. Is the debug port up at all?
let client;
try {
  client = await connect({ vault });
  note(true, `CDP reachable, attached to vault "${vault}"`);
} catch (error) {
  note(false, error.message);
  console.log(
    "\nRelaunch Obsidian with the port:\n" +
      "  osascript -e 'tell application \"Obsidian\" to quit'\n" +
      "  open -na /Applications/Obsidian.app --args --remote-debugging-port=9222",
  );
  process.exit(1);
}

// 2. Is the built bundle in the vault actually YOUR build? Every worktree's dev
//    watcher mirrors to the same vault, so another branch's watcher can silently
//    replace it — the failure looks like "my feature is missing".
const bundle = `${pluginDir}/main.js`;
if (!existsSync(bundle)) {
  note(false, `no bundle at ${bundle}`);
} else if (!marker) {
  note(
    true,
    `bundle present (pass a marker string to verify it is your build)`,
  );
} else {
  const hit = readFileSync(bundle, "utf8").includes(marker);
  note(
    hit,
    `bundle ${hit ? "contains" : "does NOT contain"} ${JSON.stringify(marker)}`,
  );
  if (!hit) {
    console.log(
      "\nAnother worktree's watcher probably overwrote it. Rebuild from yours:\n" +
        "  (cd apps/obsidian && pnpm build)\n" +
        'Check for competing watchers with: pgrep -fl "scripts/dev.ts"',
    );
  }
}

// 3. Is the plugin actually enabled?
const enabled = await client.evaluate(
  `!!app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]`,
);
note(enabled === true, `plugin ${PLUGIN_ID} enabled`);

client.close();
process.exit(report.every(Boolean) ? 0 : 1);
