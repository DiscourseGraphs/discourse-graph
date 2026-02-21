import type { Enums } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  fetchOrCreateSpaceDirect,
  fetchOrCreatePlatformAccount,
  createLoggedInClient,
  FatalError,
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
export const getVaultId = (app: DiscourseGraphPlugin["app"]): string => {
  return (app as unknown as { appId: string }).appId;
};

const canonicalObsidianUrl = (vaultId: string): string => {
  return `orn:obsidian.note:${vaultId}`;
};

export const getSupabaseContext = async (
  plugin: DiscourseGraphPlugin,
): Promise<SupabaseContext | null> => {
  if (contextCache === null) {
    try {
      const vaultName = plugin.app.vault.getName() || "obsidian-vault";
      const vaultId = getVaultId(plugin.app);

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

      contextCache = {
        platform: "Obsidian",
        spaceId,
        userId,
        spacePassword,
      };
    } catch (error) {
      console.error(error);
      if (error instanceof FatalError) throw error;
      return null;
    }
  }
  return contextCache;
};

let loggedInClient: DGSupabaseClient | null = null;

export const getLoggedInClient = async (
  plugin: DiscourseGraphPlugin,
): Promise<DGSupabaseClient | null> => {
  if (loggedInClient !== null) {
    // renew session
    const { error } = await loggedInClient.auth.getSession();
    if (error) {
      console.warn("Session renewal failed, re-authenticating:", error);
      loggedInClient = null;
    }
  }
  if (loggedInClient === null) {
    const context = await getSupabaseContext(plugin);
    if (context === null) {
      console.error("Could not create Supabase context");
    } else
      try {
        loggedInClient = await createLoggedInClient({
          platform: context.platform,
          spaceId: context.spaceId,
          password: context.spacePassword,
        });
        if (!loggedInClient) {
          console.error(
            "Failed to create Supabase client - check environment variables",
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Failed to create logged-in client:", errorMessage);
      }
  }
  return loggedInClient;
};
