import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_ARTIFACT_DIR,
  openRoamSession,
  parseArgs,
  timestamp,
} from "./roam-session.mjs";

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const slot = args.slot || process.env.DG_ROAM_PLAYWRIGHT_SLOT || "1";
  const timeout = args.timeout ? Number(args.timeout) : 30_000;
  const headless = args.headed ? false : process.env.HEADLESS !== "false";
  const outDir = path.resolve(args.out || DEFAULT_ARTIFACT_DIR);
  const screenshotName =
    args["screenshot-name"] || `roam-open-slot-${slot}-${timestamp()}.png`;
  const screenshotPath = path.join(outDir, screenshotName);
  const resultPath = path.join(outDir, `open-slot-${slot}-last-run.json`);

  await fs.mkdir(outDir, { recursive: true });

  const { context, page, slotConfig } = await openRoamSession({
    slot,
    graphUrl: args.url,
    profileDir: args["profile-dir"],
    headless,
    timeout,
    allowInteractiveLogin: Boolean(args["allow-login"]),
  });

  try {
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const result = {
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
    if (args["keep-open"]) {
      console.log("Browser context left open. Press Ctrl+C to close it.");
      await new Promise((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
    }
    await context.close();
  }
};

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
