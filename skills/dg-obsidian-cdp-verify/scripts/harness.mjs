// Scenario runner: assertions, baseline reset, exit code.
//
// A verification file declares scenarios and calls `runVerification`. Everything
// order-dependent — plugin reload, stray-modal cleanup, teardown — happens here
// so each scenario only describes its own behaviour.
import { connect } from "./driver.mjs";

export const createChecker = () => {
  const results = [];
  const check = (label, pass, detail = "") => {
    results.push({ label, pass, detail });
    console.log(
      `${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`,
    );
  };
  return { check, results };
};

/**
 * A crashed earlier run can leave a modal mounted, and a second copy in the DOM
 * makes every `querySelectorAll` return both — assertions then read a mix of two
 * modals. Clear them before asserting anything.
 */
export const clearStrayModals = async (
  client,
  { selector = ".modal" } = {},
) => {
  const gone = `!document.querySelector(${JSON.stringify(selector)})`;
  for (let attempt = 0; attempt < 5; attempt++) {
    if ((await client.evaluate(gone)) === true) return;
    await client.pressEscape();
    await new Promise((r) => setTimeout(r, 150));
  }
  await client.waitFor(gone, { label: "no stray modal at start" });
};

/**
 * @param scenarios  [{ name, body }] — body receives ({ client, check, state }).
 * @param setup      optional: runs once before scenarios, may return state.
 * @param teardown   optional: receives the value `setup` returned.
 * @param modalSelector  what counts as a stray modal to clear at start.
 */
export const runVerification = async ({
  scenarios,
  setup,
  teardown,
  modalSelector,
  vault,
}) => {
  const client = await connect(vault ? { vault } : {});
  console.log("connected to vault target");

  // Reload so a rebuilt bundle is the code actually under test.
  await client.reloadPlugin();
  await client.waitFor(
    `!!app.plugins.plugins[${JSON.stringify(process.env.PLUGIN_ID ?? "@discourse-graph/obsidian")}]`,
    {
      label: "plugin re-enabled",
    },
  );
  await clearStrayModals(
    client,
    modalSelector ? { selector: modalSelector } : {},
  );

  const { check, results } = createChecker();
  const state = setup ? await setup({ client, check }) : undefined;

  try {
    for (const scenario of scenarios) {
      console.log(`\n— ${scenario.name}`);
      await scenario.body({ client, check, state });
    }
  } finally {
    if (teardown) await teardown({ client, state });
  }

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n${results.length - failed.length}/${results.length} assertions passed`,
  );
  client.close();
  process.exit(failed.length ? 1 : 0);
};
