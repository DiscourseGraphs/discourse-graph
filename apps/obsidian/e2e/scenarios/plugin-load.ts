import type { Page } from "@playwright/test";
import { PLUGIN_ID } from "../constants";
import { captureStep } from "../helpers/screenshots";
import { waitForPluginLoaded } from "../helpers/vault";

export const runPluginLoadScenario = async ({
  page,
  testName,
}: {
  page: Page;
  testName: string;
}): Promise<void> => {
  await waitForPluginLoaded({ page, pluginId: PLUGIN_ID });
  await captureStep({
    page,
    testName,
    stepName: "01-plugin-loaded",
  });
};
