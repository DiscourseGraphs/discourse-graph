import { test } from "../fixtures/obsidian";
import { runPluginLoadScenario } from "../scenarios/plugin-load";
import { runNodeCreationScenario } from "../scenarios/node-creation";

const screenshotFolder = (title: string): string =>
  title.replace(/\s+/g, "-").toLowerCase();

test.describe("smoke", () => {
  test("plugin loads", async ({ obsidian }, testInfo) => {
    await runPluginLoadScenario({
      page: obsidian.page,
      testName: screenshotFolder(testInfo.title),
    });
  });

  test("creates a Question node via command palette", async ({
    obsidian,
  }, testInfo) => {
    await runNodeCreationScenario({
      page: obsidian.page,
      testName: screenshotFolder(testInfo.title),
      trigger: "palette",
    });
  });
});
