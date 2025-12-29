import type { Enums } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  fetchOrCreateSpaceDirect,
  fetchOrCreatePlatformAccount,
  createLoggedInClient,
} from "@repo/database/lib/contextFunctions";
import type DiscourseGraphPlugin from "~/index";

type Platform = Enums<"Platform">;

export type SupabaseContext = {
  platform: Platform;
  spaceId: number;
  userId: number;
  spacePassword: string;
};

let contextCache: SupabaseContext | null = null;

const generateAccountLocalId = (vaultName: string): string => {
  const randomSuffix = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
  return `${vaultName}-${randomSuffix}`;
};

const getOrCreateSpacePassword = async (
  plugin: DiscourseGraphPlugin,
): Promise<string> => {
  if (plugin.settings.spacePassword) {
    return plugin.settings.spacePassword;
  }
  // Generate UUID using crypto.randomUUID()
  const password = crypto.randomUUID();
  plugin.settings.spacePassword = password;
  await plugin.saveSettings();
  return password;
};

const getOrCreateAccountLocalId = async (
  plugin: DiscourseGraphPlugin,
  vaultName: string,
): Promise<string> => {
  if (plugin.settings.accountLocalId) {
    return plugin.settings.accountLocalId;
  }
  const accountLocalId = generateAccountLocalId(vaultName);
  plugin.settings.accountLocalId = accountLocalId;
  await plugin.saveSettings();
  return accountLocalId;
};

export const getSupabaseContext = async (
  plugin: DiscourseGraphPlugin,
): Promise<SupabaseContext | null> => {
  if (contextCache === null) {
    try {
      const vaultName = plugin.app.vault.getName() || "obsidian-vault";

      const spacePassword = await getOrCreateSpacePassword(plugin);
      const accountLocalId = await getOrCreateAccountLocalId(plugin, vaultName);

      // Space URL format: "space" + accountLocalId
      const url = `space${accountLocalId}`;
      const platform: Platform = "Obsidian";

      const spaceResult = await fetchOrCreateSpaceDirect({
        password: spacePassword,
        url,
        name: vaultName,
        platform,
      });

      if (!spaceResult.data) {
        console.error("Failed to create space");
        return null;
      }

      const spaceId = spaceResult.data.id;
      const userId = await fetchOrCreatePlatformAccount({
        platform: "Obsidian",
        accountLocalId,
        name: vaultName,
        email: undefined,
        spaceId,
        password: spacePassword,
      });

      contextCache = {
        platform: "Obsidian",
        spaceId,
        userId,
        spacePassword,
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  }
  return contextCache;
};

let loggedInClient: DGSupabaseClient | null = null;

export const getLoggedInClient = async (
  plugin: DiscourseGraphPlugin,
): Promise<DGSupabaseClient | null> => {
  if (loggedInClient === null) {
    const context = await getSupabaseContext(plugin);
    if (context === null) throw new Error("Could not create context");
    loggedInClient = await createLoggedInClient(
      context.platform,
      context.spaceId,
      context.spacePassword,
    );
  } else {
    // renew session
    const { error } = await loggedInClient.auth.getSession();
    if (error) {
      loggedInClient = null;
    }
  }
  return loggedInClient;
};
