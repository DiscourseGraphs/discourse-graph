import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium as defaultChromium } from "playwright";

export { defaultChromium };

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROAM_APP_ROOT = path.resolve(SCRIPT_DIR, "../..");
export const REPO_ROOT = path.resolve(ROAM_APP_ROOT, "../..");
export const DEFAULT_ENV_PATH = path.join(ROAM_APP_ROOT, ".env");
export const DEFAULT_ARTIFACT_DIR = path.join(
  REPO_ROOT,
  "local/roam-playwright/artifacts",
);
const SLOT_VALUES = ["1", "2", "3"];

const READY_SELECTORS = [
  ".roam-app",
  ".roam-body",
  'input[placeholder="Find or Create Page"]',
];

let envLoaded = false;

export const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const nextToken = argv[index + 1];
    args[key] = nextToken && !nextToken.startsWith("--") ? argv[++index] : true;
  }
  return args;
};

export const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

export const getEnvPath = () =>
  path.resolve(process.env.DG_ROAM_PLAYWRIGHT_ENV_PATH || DEFAULT_ENV_PATH);

export const loadRootEnv = (envPath = getEnvPath()) => {
  if (envLoaded) return;
  envLoaded = true;
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) process.env[key] = value;
  }
};

export const normalizeSlot = (slotValue = "1") => {
  const slot = String(slotValue);
  if (!SLOT_VALUES.includes(slot)) {
    throw new Error(`Invalid Playwright slot "${slot}". Expected 1, 2, or 3.`);
  }
  return slot;
};

export const defaultProfileDirForSlot = (slot) =>
  path.join(REPO_ROOT, `local/roam-playwright/profiles/playwright-${slot}`);

export const slotEnvKey = ({ slot, name }) =>
  `DG_ROAM_PLAYWRIGHT_${name}_${slot}`;

export const getSlotEnvValue = ({ slot, name }) =>
  process.env[slotEnvKey({ slot, name })];

export const graphNameFromRoamUrl = (graphUrl) => {
  const hashMatch = /#\/app\/([^/?#]+)/.exec(graphUrl);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);

  throw new Error(
    "Could not infer a Roam graph name from DG_ROAM_PLAYWRIGHT_GRAPH_URL. Expected a URL like https://roamresearch.com/#/app/<graph>.",
  );
};

export const resolveSlotConfig = ({
  slot: slotValue = process.env.DG_ROAM_PLAYWRIGHT_SLOT || "1",
  requireCredentials = true,
  graphUrl,
  profileDir,
} = {}) => {
  loadRootEnv();
  const slot = normalizeSlot(slotValue);
  const config = {
    slot,
    email: getSlotEnvValue({ slot, name: "EMAIL" }),
    password: getSlotEnvValue({ slot, name: "PASSWORD" }),
    graphUrl: graphUrl || getSlotEnvValue({ slot, name: "GRAPH_URL" }),
    profileDir:
      profileDir ||
      getSlotEnvValue({ slot, name: "PROFILE_DIR" }) ||
      defaultProfileDirForSlot(slot),
  };

  const missing = [];
  if (!config.graphUrl) missing.push(slotEnvKey({ slot, name: "GRAPH_URL" }));
  if (requireCredentials && !config.email) {
    missing.push(slotEnvKey({ slot, name: "EMAIL" }));
  }
  if (requireCredentials && !config.password) {
    missing.push(slotEnvKey({ slot, name: "PASSWORD" }));
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")} in ${getEnvPath()}. Keep Roam test account and graph identifiers in the ignored apps/roam/.env, not in committed files.`,
    );
  }

  return config;
};

const looksLikeSignin = async (page) =>
  page.url().includes("/signin") ||
  page.url().includes("#/signin") ||
  (await page.locator('input[type="password"]').count()) > 0;

const waitForReadySelector = async ({ page, timeout }) => {
  await page.waitForFunction(
    (selectors) =>
      selectors.some((selector) => document.querySelector(selector)),
    READY_SELECTORS,
    { timeout },
  );
};

const loginWithStoredCredentials = async ({
  page,
  email,
  password,
  timeout,
}) => {
  await page
    .locator('input[name="email"], input[type="email"]')
    .first()
    .fill(email, { timeout });
  await page
    .locator('input[name="password"], input[type="password"]')
    .first()
    .fill(password, { timeout });

  await page
    .locator("button")
    .filter({ hasText: /^(Sign In|Log In)$/i })
    .first()
    .click({ timeout });

  await waitForReadySelector({ page, timeout });
};

export const waitForRoamReady = async ({
  page,
  slotConfig,
  headless,
  allowInteractiveLogin = false,
  allowCredentialLogin = process.env.DG_ROAM_PLAYWRIGHT_AUTO_LOGIN !== "false",
  timeout = 30_000,
  loginTimeout = 5 * 60_000,
}) => {
  await page.waitForTimeout(1500);

  if (await looksLikeSignin(page)) {
    if (allowCredentialLogin && slotConfig.password) {
      await loginWithStoredCredentials({
        page,
        email: slotConfig.email,
        password: slotConfig.password,
        timeout,
      });
      return;
    }

    if (headless || !allowInteractiveLogin) {
      throw new Error(
        `Roam profile is not logged in or the session expired (${slotConfig.profileDir}). ` +
          "Run with --headed --allow-login, complete login, then rerun.",
      );
    }

    console.log(
      "Roam login required. Complete login in the opened browser window.",
    );
    await page.waitForFunction(
      (selectors) => {
        const notSignin =
          !location.href.includes("/signin") &&
          !location.href.includes("#/signin");
        return (
          notSignin &&
          selectors.some((selector) => document.querySelector(selector))
        );
      },
      READY_SELECTORS,
      { timeout: loginTimeout },
    );
    return;
  }

  await waitForReadySelector({ page, timeout });
};

export const openRoamSession = async ({
  slot = process.env.DG_ROAM_PLAYWRIGHT_SLOT || "1",
  graphUrl,
  profileDir,
  headless = process.env.HEADLESS !== "false",
  viewport = { width: 1440, height: 1000 },
  timeout = 30_000,
  allowInteractiveLogin = false,
  allowCredentialLogin = process.env.DG_ROAM_PLAYWRIGHT_AUTO_LOGIN !== "false",
  chromium = defaultChromium,
} = {}) => {
  const slotConfig = resolveSlotConfig({ slot, graphUrl, profileDir });
  const resolvedConfig = {
    ...slotConfig,
    profileDir: path.resolve(slotConfig.profileDir),
  };

  fs.mkdirSync(resolvedConfig.profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(
    resolvedConfig.profileDir,
    {
      headless,
      viewport,
    },
  );

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(resolvedConfig.graphUrl, { waitUntil: "domcontentloaded" });
  await waitForRoamReady({
    page,
    slotConfig: resolvedConfig,
    headless,
    allowInteractiveLogin,
    allowCredentialLogin,
    timeout,
  });

  return { context, page, slotConfig: resolvedConfig };
};
