// We made the decision to use "Store relations" terminology for the UI
// But there is still some legacy code that uses "Reified relations" terminology.
// ENG-1521: Update internal terminology to use "stored" instead of "reified"

import { USE_STORED_RELATIONS } from "~/data/userSettings";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/data/constants";
import { getSetting, setSetting } from "./extensionSettings";
import { getPersonalSettingsKey } from "~/components/settings/utils/zodSchema";
import { PERSONAL_KEYS } from "~/components/settings/utils/settingKeys";
import { isJsonObject, normalizeProps, type json } from "./getBlockProps";

const INSTALL_CUTOFF = Date.parse("2026-03-01T00:00:00.000Z");

const setResolvedDefault = (value: boolean): void => {
  void setSetting(USE_STORED_RELATIONS, value).catch(() => undefined);
};

type ConfigPage = {
  ":create/time"?: number;
  ":block/children"?: Record<string, json>[];
} | null;

// Stored relations are the default for new DG installs. We use the config
// page create date as the install cutoff because it reflects when DG was first
// initialized in the graph.
const getInstallDefault = (page: ConfigPage): boolean => {
  if (!page) return true; // handle case where config page doesn't exist yet, assume new install

  const createdAt = page[":create/time"];
  return typeof createdAt === "number" && createdAt >= INSTALL_CUTOFF;
};

// Extension settings reset when a dev extension is re-added; the graph keeps the user's choice.
const getGraphStoredRelations = (page: ConfigPage): boolean | undefined => {
  const personalKey = getPersonalSettingsKey();
  if (!personalKey) return undefined;
  const personalBlock = page?.[":block/children"]?.find(
    (child) => child[":block/string"] === personalKey,
  );
  const props = normalizeProps(personalBlock?.[":block/props"] ?? null);
  const value = isJsonObject(props)
    ? props[PERSONAL_KEYS.reifiedRelationTriples]
    : undefined;
  return typeof value === "boolean" ? value : undefined;
};

// Persist the resolved value under the setting key so future reads use it directly.
export const getStoredRelationsEnabled = (): boolean => {
  const value = getSetting<boolean | undefined>(USE_STORED_RELATIONS);
  if (typeof value === "boolean") return value;

  const page = window.roamAlphaAPI.pull(
    "[:create/time {:block/children [:block/string :block/props]}]",
    [":node/title", DISCOURSE_CONFIG_PAGE_TITLE],
  ) as ConfigPage;
  const resolvedDefault =
    getGraphStoredRelations(page) ?? getInstallDefault(page);
  setResolvedDefault(resolvedDefault);
  return resolvedDefault;
};
