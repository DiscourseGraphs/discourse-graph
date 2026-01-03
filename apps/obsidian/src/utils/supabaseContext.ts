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
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const sanitizedVaultName = vaultName
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/-+/g, "-");
  return `${sanitizedVaultName}${randomSuffix}@database.discoursegraphs.com`;
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
        accountLocalId,
        accountName: vaultName,
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
  const accountLocalId = plugin.settings.accountLocalId;
  if (!accountLocalId) {
    throw new Error("accountLocalId not found in plugin settings");
  }
  if (loggedInClient === null) {
    const context = await getSupabaseContext(plugin);
    if (context === null) {
      throw new Error("Could not create Supabase context");
    }
    try {
      loggedInClient = await createLoggedInClient({
        platform: context.platform,
        spaceId: context.spaceId,
        password: context.spacePassword,
        accountLocalId,
      });
      if (!loggedInClient) {
        throw new Error(
          "Failed to create Supabase client - check environment variables",
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to create logged-in client:", errorMessage);
      throw new Error(`Supabase authentication failed: ${errorMessage}`);
    }
  } else {
    // renew session
    const { error } = await loggedInClient.auth.getSession();
    if (error) {
      console.warn("Session renewal failed, re-authenticating:", error);
      loggedInClient = null;
      const context = await getSupabaseContext(plugin);
      if (context === null) {
        throw new Error(
          "Could not create Supabase context for re-authentication",
        );
      }

      loggedInClient = await createLoggedInClient({
        platform: context.platform,
        spaceId: context.spaceId,
        password: context.spacePassword,
        accountLocalId,
      });
      if (!loggedInClient) {
        throw new Error("Failed to re-authenticate Supabase client");
      }
    }
  }
  return loggedInClient;
};
