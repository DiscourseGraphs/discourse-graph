// Worked example — the verification that shipped ENG-2114 ("insert active search
// result as a link at cursor"). 15 assertions across 3 scenarios. Read this
// before writing your own.
//
//   node examples/insert-link-at-cursor.mjs
import { runVerification } from "../scripts/harness.mjs";

const SCRATCH = "__verify-scratch.md";
const MODAL = ".dg-node-search-modal";
const json = (v) => JSON.stringify(v);

const setLinkConfig = (client, { useMarkdownLinks, newLinkFormat }) =>
  client.evaluate(`
    app.vault.setConfig("useMarkdownLinks", ${json(useMarkdownLinks)});
    app.vault.setConfig("newLinkFormat", ${json(newLinkFormat)});
    return true;
  `);

// `getLeaf("tab")` reuses an empty active leaf, so this does not pile up tabs.
// Detaching every markdown leaf first would leave no tab group to open into.
const openScratchAt = async (client, body, line, ch) => {
  await client.evaluate(`
    return (async () => {
      const existing = app.vault.getAbstractFileByPath(${json(SCRATCH)});
      if (existing) await app.vault.modify(existing, ${json(body)});
      else await app.vault.create(${json(SCRATCH)}, ${json(body)});
      const file = app.vault.getAbstractFileByPath(${json(SCRATCH)});
      const leaf = app.workspace.getLeaf("tab");
      await leaf.openFile(file, { state: { mode: "source" } });
      app.workspace.setActiveLeaf(leaf, { focus: true });
      return true;
    })();
  `);
  await client.evaluate(`
    const view = app.workspace.activeLeaf.view;
    view.editor.focus();
    view.editor.setCursor({ line: ${line}, ch: ${ch} });
    return true;
  `);
};

const openSearch = async (client) => {
  await client.evaluate(
    `return app.commands.executeCommandById("@discourse-graph/obsidian:open-node-search");`,
  );
  await client.waitFor(`!!document.querySelector(${json(MODAL)})`, {
    label: "search modal open",
  });
};

const footerLabels = (client) =>
  client.evaluate(`
    return Array.from(
      document.querySelectorAll(${json(`${MODAL} .dg-search-footer-action`)}),
    ).map((el) => el.textContent.trim());
  `);

const typeQuery = async (client, text) => {
  await client.evaluate(`
    document.querySelector(${json(`${MODAL} input`)}).focus();
    return true;
  `);
  await client.typeText(text);
  // Beat the 250ms search debounce.
  await client.waitFor(
    `document.querySelectorAll(${json(`${MODAL} [role="option"]`)}).length > 0`,
    { label: "results rendered", timeout: 4000 },
  );
};

const pressModEnter = (client) =>
  client.key({
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
    modifiers: 4, // Meta
  });

const readScratch = (client) =>
  client.evaluate(
    `return app.vault.read(app.vault.getAbstractFileByPath(${json(SCRATCH)}));`,
  );

// The editor change reaches disk on Obsidian's debounced save, so content
// assertions poll rather than reading straight after the modal closes.
const waitForScratchChange = (client, original, label) =>
  client.waitFor(
    `app.vault.read(app.vault.getAbstractFileByPath(${json(SCRATCH)})).then((t) => t !== ${json(original)})`,
    { label },
  );

/**
 * `editor.hasFocus()` also requires `document.hasFocus()`, so it reads false
 * whenever the Obsidian window is not the frontmost macOS app — which says
 * nothing about the code. Whether `document.activeElement` sits inside the
 * editor is the signal that survives an unfocused window.
 */
const editorState = (client) =>
  client.evaluate(`
    const editor = app.workspace.activeLeaf.view.editor;
    const el = document.activeElement;
    return {
      focusInEditor: !!(el && el.closest(".cm-editor")),
      documentHasFocus: document.hasFocus(),
      cursor: editor.getCursor(),
      path: app.workspace.activeLeaf.view.file.path,
    };
  `);

const targetNodeTitle = (client) =>
  client.evaluate(`
    const files = app.vault.getMarkdownFiles().filter((f) => f.path !== ${json(SCRATCH)});
    return files[0].basename;
  `);

const insertScenario =
  ({ label, useMarkdownLinks, newLinkFormat }) =>
  async ({ client, check, state }) => {
    await setLinkConfig(client, { useMarkdownLinks, newLinkFormat });
    const original = "before| after\n";
    await openScratchAt(client, original, 0, 6);
    await openSearch(client);

    const labels = await footerLabels(client);
    check(
      `${label}: insert action present in footer`,
      labels.some((l) => l.includes("insert link at cursor")),
      labels.join(" / "),
    );

    await typeQuery(client, state.nodeTitle.slice(0, 4));
    await pressModEnter(client);

    await client.waitFor(`!document.querySelector(${json(MODAL)})`, {
      label: `${label}: modal closed`,
    });
    check(`${label}: modal closed after insert`, true);

    await waitForScratchChange(client, original, `${label}: note written`);
    const text = await readScratch(client);
    const inserted = text
      .replace("before", "")
      .replace(" after\n", "")
      .replace("|", "");
    check(
      `${label}: link landed at pre-open cursor (col 6)`,
      text.startsWith("before") &&
        text.endsWith(" after\n") &&
        text !== original,
      json(text),
    );
    check(
      `${label}: format is ${useMarkdownLinks ? "markdown" : "wikilink"}`,
      useMarkdownLinks
        ? /^\[[^\]]*\]\([^)]*\)$/.test(inserted.trim())
        : /^\[\[.*\]\]$/.test(inserted.trim()),
      inserted.trim(),
    );

    const focus = await editorState(client);
    check(
      `${label}: focus returned to the editor`,
      focus.focusInEditor === true,
      json(focus),
    );
    check(
      `${label}: cursor sits after the inserted link`,
      focus.cursor.line === 0 && focus.cursor.ch > 6,
      `ch=${focus.cursor.ch}`,
    );
    check(
      `${label}: inserted into the pre-open note`,
      focus.path === SCRATCH,
      focus.path,
    );
  };

await runVerification({
  modalSelector: MODAL,
  // These scenarios flip the vault's own link settings, so the originals are
  // captured up front and put back in teardown — never leave a teammate's vault
  // reconfigured by a verification run.
  setup: async ({ client }) => ({
    nodeTitle: await targetNodeTitle(client),
    linkConfig: await client.evaluate(`return {
      useMarkdownLinks: app.vault.getConfig("useMarkdownLinks"),
      newLinkFormat: app.vault.getConfig("newLinkFormat"),
    };`),
  }),
  teardown: async ({ client, state }) => {
    await setLinkConfig(client, state.linkConfig);
    await client.evaluate(`
      const scratch = app.vault.getAbstractFileByPath(${json(SCRATCH)});
      return (scratch ? app.vault.trash(scratch, true) : Promise.resolve()).then(() => true);
    `);
    console.log("restored vault link config, trashed scratch note");
  },
  scenarios: [
    {
      name: "01-insert-wikilink-shortest",
      body: insertScenario({
        label: "wikilink/shortest",
        useMarkdownLinks: false,
        newLinkFormat: "shortest",
      }),
    },
    {
      name: "02-insert-markdown-absolute",
      body: insertScenario({
        label: "markdown/absolute",
        useMarkdownLinks: true,
        newLinkFormat: "absolute",
      }),
    },
    {
      name: "03-absent-without-cursor",
      body: async ({ client, check }) => {
        await client.evaluate(`
          app.workspace.detachLeavesOfType("markdown");
          return true;
        `);
        await openSearch(client);
        const labels = await footerLabels(client);
        check(
          "insert action absent with no note open",
          !labels.some((l) => l.includes("insert link at cursor")),
          labels.join(" / "),
        );
        await client.pressEscape();
        await client.waitFor(`!document.querySelector(${json(MODAL)})`, {
          label: "modal closed",
        });
      },
    },
  ],
});
