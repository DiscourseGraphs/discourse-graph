import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_ARTIFACT_DIR,
  getBooleanArg,
  getEnvValue,
  getStringArg,
  openRoamSession,
  parseArgs,
  timestamp,
} from "./roamSession";

type OpenRoamResult = {
  ok: true;
  slot: string;
  configuredGraphLoaded: boolean;
  pageTitleAvailable: boolean;
  profileDir: string;
  screenshotPath: string;
  resultPath: string;
  headless: boolean;
  capturedAt: string;
};

const waitForTermination = async (): Promise<void> =>
  new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const slot =
    getStringArg(args, "slot") || getEnvValue("DG_ROAM_PLAYWRIGHT_SLOT") || "1";
  const timeout = Number(getStringArg(args, "timeout") || 30_000);
  const headless = getBooleanArg(args, "headed")
    ? false
    : getEnvValue("HEADLESS") !== "false";
  const outDir = path.resolve(
    getStringArg(args, "out") || DEFAULT_ARTIFACT_DIR,
  );
  const screenshotName =
    getStringArg(args, "screenshot-name") ||
    `roam-open-slot-${slot}-${timestamp()}.png`;
  const screenshotPath = path.join(outDir, screenshotName);
  const resultPath = path.join(outDir, `open-slot-${slot}-last-run.json`);

  await fs.mkdir(outDir, { recursive: true });

  const { context, page, slotConfig } = await openRoamSession({
    slot,
    graphUrl: getStringArg(args, "url"),
    profileDir: getStringArg(args, "profile-dir"),
    headless,
    timeout,
    allowInteractiveLogin: getBooleanArg(args, "allow-login"),
  });

  try {
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const result: OpenRoamResult = {
      ok: true,
      slot: slotConfig.slot,
      configuredGraphLoaded: page.url().startsWith(slotConfig.graphUrl),
      pageTitleAvailable: Boolean(await page.title()),
      profileDir: slotConfig.profileDir,
      screenshotPath,
      resultPath,
      headless,
      capturedAt: new Date().toISOString(),
    };

    await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (getBooleanArg(args, "keep-open")) {
      console.log("Browser context left open. Press Ctrl+C to close it.");
      await waitForTermination();
    }
    await context.close();
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : error;
  console.error(message);
  process.exit(1);
});
