// We made the decision to use "Store relations" terminology for the UI
// But there is still some legacy code that uses "Refied relations" terminology.
// ENG-1521: Update internal terminology to use "stored" instead of "reified"

import { USE_STORED_RELATIONS } from "~/data/userSettings";
import { getSetting, setSetting } from "./extensionSettings";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "./renderNodeConfigPage";

const INSTALL_CUTOFF = Date.parse("2026-04-01T00:00:00.000Z");

const setResolvedDefault = (value: boolean): void => {
  void setSetting(USE_STORED_RELATIONS, value).catch(() => undefined);
};

// Stored relations are the default for new DG installs. We use the config
// page create date as the install cutoff because it reflects when DG was first
// initialized in the graph.
const getInstallDefault = (): boolean | undefined => {
  const page = window.roamAlphaAPI.pull(
    "[:create/time]",
    [":node/title", DISCOURSE_CONFIG_PAGE_TITLE],
    // eslint-disable-next-line @typescript-eslint/naming-convention
  ) as { ":create/time"?: number } | null;
  if (!page) return undefined;

  const createdAt = page[":create/time"];
  return typeof createdAt === "number" && createdAt >= INSTALL_CUTOFF;
};

// Once the config page exists, persist the resolved default under the new
// setting key so future reads can use the explicit setting path directly.
export const getStoredRelationsEnabled = (): boolean => {
  const value = getSetting<boolean | undefined>(USE_STORED_RELATIONS);
  if (typeof value === "boolean") return value;

  const resolvedDefault = getInstallDefault();
  if (typeof resolvedDefault !== "boolean") return false;

  setResolvedDefault(resolvedDefault);
  return resolvedDefault;
};
