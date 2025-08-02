import getCurrentUserEmail from "roamjs-components/queries/getCurrentUserEmail";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";

import { Enums } from "@repo/database/types.gen";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import getBlockProps from "~/utils/getBlockProps";
import setBlockProps from "~/utils/setBlockProps";
import { type DGSupabaseClient } from "@repo/ui/lib/supabase/client";
import {
  fetchOrCreateSpaceDirect,
  fetchOrCreatePlatformAccount,
  createLoggedInClient,
} from "@repo/ui/lib/supabase/contextFunctions";

declare const crypto: { randomUUID: () => string };

type Platform = Enums<"Platform">;

export type SupabaseContext = {
  platform: Platform;
  spaceId: number;
  userId: number;
  spacePassword: string;
};

let _contextCache: SupabaseContext | null = null;
const getOrCreateSpacePassword = () => {
  const settingsConfigPageUid = getPageUidByPageTitle(
    DISCOURSE_CONFIG_PAGE_TITLE,
  );
  const props = getBlockProps(settingsConfigPageUid);
  const existing: string | unknown = props["space-user-password"];
  if (existing && typeof existing === "string") return existing;
  // use a uuid as password, at least cryptographically safe
  const password = crypto.randomUUID();
  setBlockProps(settingsConfigPageUid, {
    "space-user-password": password,
  });
  return password;
};

// Note: calls in this file will still use vercel endpoints.
// It is better if this is still at least protected by CORS.
// But calls anywhere else should use the supabase client directly.

export const getSupabaseContext = async (): Promise<SupabaseContext | null> => {
  if (_contextCache === null) {
    try {
      const accountLocalId = window.roamAlphaAPI.user.uid();
      const spacePassword = getOrCreateSpacePassword();
      const personEmail = getCurrentUserEmail();
      const personName = getCurrentUserDisplayName();
      const url = getRoamUrl();
      const spaceName = window.roamAlphaAPI.graph.name;
      const platform: Platform = "Roam";
      const spaceResult = await fetchOrCreateSpaceDirect({
        password: spacePassword,
        url,
        name: spaceName,
        platform,
      });
      if (!spaceResult.data) throw new Error("Failed to create space");
      const spaceId = spaceResult.data.id;
      const userId = await fetchOrCreatePlatformAccount({
        platform: "Roam",
        accountLocalId,
        name: personName,
        email: personEmail,
        spaceId,
        password: spacePassword,
      });
      _contextCache = {
        platform: "Roam",
        spaceId,
        userId,
        spacePassword,
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  }
  return _contextCache;
};

let _loggedInClient: DGSupabaseClient | null = null;

export const getLoggedInClient = async (): Promise<DGSupabaseClient> => {
  if (_loggedInClient === null) {
    const context = await getSupabaseContext();
    if (context === null) throw new Error("Could not create context");
    _loggedInClient = await createLoggedInClient(
      context.platform,
      context.spaceId,
      context.spacePassword,
    );
  } else {
    // renew session
    const { error } = await _loggedInClient.auth.getSession();
    if (error) {
      _loggedInClient = null;
      throw new Error(`Authentication expired: ${error.message}`);
    }
  }
  return _loggedInClient;
};
