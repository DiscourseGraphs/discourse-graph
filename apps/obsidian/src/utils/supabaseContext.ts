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

const contextCache: Record<string, SupabaseContext> = {};

const generateAccountLocalId = (vaultName: string): string => {
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const sanitizedVaultName = vaultName
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/-+/g, "-");
  return `${sanitizedVaultName}${randomSuffix}`;
};

const getOrCreateSpacePassword = async (
  plugin: DiscourseGraphPlugin,
): Promise<string> => {
  if (plugin.settings.spacePassword) {
    return plugin.settings.spacePassword;
  }
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

/**
 * Gets the unique vault ID from Obsidian's internal API.
 * @see https://help.obsidian.md/Extending+Obsidian/Obsidian+URI
 */
const getVaultId = (app: DiscourseGraphPlugin["app"]): string => {
  return (app as unknown as { appId: string }).appId;
};

const canonicalObsidianUrl = (vaultId: string): string => {
  return `obsidian:${vaultId}`;
};

export const getSupabaseContext = async (
  plugin: DiscourseGraphPlugin,
): Promise<SupabaseContext | null> => {
  const vaultId = getVaultId(plugin.app);
  let context = contextCache[vaultId];
  if (context === undefined) {
    try {
      const vaultName = plugin.app.vault.getName() || "obsidian-vault";

      const spacePassword = await getOrCreateSpacePassword(plugin);
      const accountLocalId = await getOrCreateAccountLocalId(plugin, vaultName);

      const url = canonicalObsidianUrl(vaultId);
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
        email: accountLocalId,
        spaceId,
        password: spacePassword,
      });

      contextCache[vaultId] = context = {
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
  return context;
};

const loggedInClients: Record<string, DGSupabaseClient> = {};

export const getLoggedInClient = async (
  plugin: DiscourseGraphPlugin,
): Promise<DGSupabaseClient | null> => {
  const vaultId = getVaultId(plugin.app);
  let loggedInClient: DGSupabaseClient | null | undefined =
    loggedInClients[vaultId];
  if (loggedInClient === undefined) {
    const context = await getSupabaseContext(plugin);
    if (context === null) {
      throw new Error("Could not create Supabase context");
    }
    try {
      loggedInClient = await createLoggedInClient({
        platform: context.platform,
        spaceId: context.spaceId,
        password: context.spacePassword,
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
      });
      if (!loggedInClient) {
        throw new Error("Failed to re-authenticate Supabase client");
      }
    }
  }
  loggedInClients[vaultId] = loggedInClient;
  return loggedInClient;
};
