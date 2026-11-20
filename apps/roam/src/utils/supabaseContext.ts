import getCurrentUserEmail from "roamjs-components/queries/getCurrentUserEmail";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";

import canonicalRoamUrl from "./canonicalRoamUrl";
import { getHostedRoamGraphName } from "./roamCloudAccess";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/data/constants";
import getBlockProps from "~/utils/getBlockProps";
import setBlockProps from "~/utils/setBlockProps";
import type { Enums } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import internalError from "./internalError";
import {
  fetchOrCreateSpaceDirect,
  fetchOrCreatePlatformAccount,
  createLoggedInClient,
  FatalError,
} from "@repo/database/lib/contextFunctions";

declare const crypto: { randomUUID: () => string };

type Platform = Enums<"Platform">;

export type SupabaseContext = {
  platform: Platform;
  spaceId: number;
  userId: number;
  spacePassword: string;
};

type GraphConnection = {
  name: string;
  accountLocalId: string;
  context: Promise<SupabaseContext | null> | null;
  client: DGSupabaseClient | null;
};

let activeConnection: GraphConnection | null = null;

const getGraphConnection = (): GraphConnection | null => {
  const name = getHostedRoamGraphName();
  const accountLocalId = name ? window.roamAlphaAPI.user.uid() : null;
  if (!name || !accountLocalId) {
    activeConnection = null;
  } else if (
    activeConnection?.name !== name ||
    activeConnection.accountLocalId !== accountLocalId
  ) {
    activeConnection = { name, accountLocalId, context: null, client: null };
  }
  return activeConnection;
};

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

const loadContext = async (
  connection: GraphConnection,
): Promise<SupabaseContext | null> => {
  try {
    const { name, accountLocalId } = connection;
    const spacePassword = getOrCreateSpacePassword();
    const personEmail = getCurrentUserEmail();
    const personName = getCurrentUserDisplayName();
    const platform: Platform = "Roam";
    const spaceResult = await fetchOrCreateSpaceDirect({
      password: spacePassword,
      url: canonicalRoamUrl(name),
      name,
      platform,
    });
    if (connection !== getGraphConnection()) return null;
    if (!spaceResult.data) {
      console.error("Failed to create space");
      return null;
    }

    const spaceId = spaceResult.data.id;
    const userId = await fetchOrCreatePlatformAccount({
      platform,
      accountLocalId,
      name: personName,
      email: personEmail,
      spaceId,
      password: spacePassword,
    });
    return { platform, spaceId, userId, spacePassword };
  } catch (error) {
    console.error(error);
    if (error instanceof FatalError) throw error;
    return null;
  }
};

export const getSupabaseContext = async (): Promise<SupabaseContext | null> => {
  const connection = getGraphConnection();
  if (!connection) return null;

  const pending = (connection.context ??= loadContext(connection));
  let context: SupabaseContext | null = null;
  try {
    context = await pending;
    return connection === getGraphConnection() ? context : null;
  } finally {
    if (!context && connection.context === pending) connection.context = null;
  }
};

export const getLoggedInClient = async (): Promise<DGSupabaseClient | null> => {
  const connection = getGraphConnection();
  if (!connection) return null;

  const cachedClient = connection.client;
  if (cachedClient) {
    const { error } = await cachedClient.auth.getSession();
    if (connection !== getGraphConnection()) return null;
    if (!error) return cachedClient;
    connection.client = null;
  }

  const context = await getSupabaseContext();
  if (connection !== getGraphConnection()) return null;
  if (!context) {
    internalError({ error: "Could not create context" });
    return null;
  }

  try {
    const client = await createLoggedInClient({
      platform: context.platform,
      spaceId: context.spaceId,
      password: context.spacePassword,
    });
    if (connection !== getGraphConnection()) return null;

    connection.client = client;
    return client;
  } catch (error) {
    if (connection === getGraphConnection()) {
      internalError({ error, userMessage: "Could not access database" });
    }
    return null;
  }
};
