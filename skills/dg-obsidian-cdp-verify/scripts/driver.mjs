// Minimal Chrome DevTools Protocol driver for a running Obsidian.
//
// Obsidian is Electron, so it exposes CDP when launched with
// --remote-debugging-port. ~150 lines covers evaluate, input injection and
// polling; Playwright is not required.
import { resolveWebSocket } from "./websocket.mjs";

const PORT = Number(process.env.CDP_PORT ?? 9222);
export const PLUGIN_ID = process.env.PLUGIN_ID ?? "@discourse-graph/obsidian";
const POLL_MS = 25;

const listTargets = async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  if (!res.ok) throw new Error(`CDP list failed: ${res.status}`);
  return res.json();
};

/**
 * Picks the page target by vault name, not by title: several page targets exist
 * (one per open vault, plus popouts and settings windows) and titles collide.
 */
export const connect = async ({
  vault = process.env.VAULT ?? "testVault",
} = {}) => {
  const targets = (await listTargets()).filter(
    (t) => t.type === "page" && !t.url.startsWith("devtools://"),
  );
  if (!targets.length) {
    throw new Error(
      `No CDP page targets on port ${PORT}. Is Obsidian running with ` +
        "--remote-debugging-port? See SKILL.md, step 1.",
    );
  }

  for (const target of targets) {
    const client = await open(target.webSocketDebuggerUrl);
    const isVault = await client.evaluate(
      `!!document.querySelector(".workspace") && app.vault.getName() === ${JSON.stringify(vault)}`,
    );
    if (isVault === true) return client;
    client.close();
  }
  throw new Error(
    `No page target for vault "${vault}". Open that vault, or set VAULT=<name>.`,
  );
};

const open = async (url) => {
  const WebSocket = await resolveWebSocket();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = new Map();

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.method) {
        listeners.get(msg.method)?.(msg.params);
        return;
      }
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
      else entry.resolve(msg.result);
    });
    ws.on("error", reject);

    ws.on("open", () => {
      const send = (method, params = {}) =>
        new Promise((res, rej) => {
          const nextId = ++id;
          pending.set(nextId, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: nextId, method, params }));
        });

      /**
       * Bodies are wrapped in a plain function, so top-level `await` throws.
       * Return a promise chain instead; `awaitPromise` resolves it.
       */
      const evaluate = async (expression) => {
        const wrapped = expression.includes("return")
          ? expression
          : `return (${expression});`;
        const result = await send("Runtime.evaluate", {
          expression: `(() => { ${wrapped} })()`,
          awaitPromise: true,
          returnByValue: true,
        });
        if (result.exceptionDetails) {
          const detail =
            result.exceptionDetails.exception?.description ??
            result.exceptionDetails.text;
          throw new Error(`evaluate failed: ${detail}\n${expression}`);
        }
        return result.result.value;
      };

      /** Always poll for a condition. Fixed sleeps make runs slower AND flakier. */
      const waitFor = async (expression, { timeout = 5000, label } = {}) => {
        const deadline = Date.now() + timeout;
        for (;;) {
          if ((await evaluate(expression)) === true) return;
          if (Date.now() > deadline)
            throw new Error(`timeout waiting for ${label ?? expression}`);
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
      };

      /**
       * `type` is applied after the caller's options on purpose: a caller
       * passing `type: "keyDown"` would otherwise override the loop and send two
       * keydowns, which looks exactly like the app double-handling one keypress.
       */
      const key = async (opts = {}) => {
        for (const type of ["keyDown", "keyUp"]) {
          await send("Input.dispatchKeyEvent", { ...opts, type });
        }
      };

      const typeText = async (text, { delayMs = 0 } = {}) => {
        for (const char of text) {
          await key({ text: char, key: char });
          if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        }
      };

      /** Reload so a rebuilt bundle is actually the code under test. */
      const reloadPlugin = () =>
        evaluate(`
          return app.plugins
            .disablePlugin(${JSON.stringify(PLUGIN_ID)})
            .then(() => app.plugins.enablePlugin(${JSON.stringify(PLUGIN_ID)}))
            .then(() => true);
        `);

      const pressEscape = () =>
        key({
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
          nativeVirtualKeyCode: 27,
        });

      resolve({
        send,
        on: (method, handler) => listeners.set(method, handler),
        evaluate,
        waitFor,
        key,
        typeText,
        reloadPlugin,
        pressEscape,
        close: () => ws.close(),
      });
    });
  });
};
