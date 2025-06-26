import { getNodeEnv } from "roamjs-components/util/env";
import getCurrentUserEmail from "roamjs-components/queries/getCurrentUserEmail";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";

import { Database } from "@repo/database/types.gen";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import getBlockProps from "~/utils/getBlockProps";
import setBlockProps from "~/utils/setBlockProps";

declare const crypto: { randomUUID: () => string };

type Platform = Database["public"]["Enums"]["Platform"];

export type SupabaseContext = {
  platform: Platform;
  spaceId: number;
  userId: number;
  spacePassword: string;
};

let CONTEXT_CACHE: SupabaseContext | null = null;

// TODO: This should be an util on its own.
const base_url =
  getNodeEnv() === "development"
    ? "http://localhost:3000/api/supabase"
    : "https://discoursegraphs.com/api/supabase";

const settingsConfigPageUid = getPageUidByPageTitle(
  DISCOURSE_CONFIG_PAGE_TITLE,
);

const getOrCreateSpacePassword = () => {
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

// Note: Some of this will be more typesafe if rewritten with direct supabase access eventually.
// We're going through nextjs until we have settled security.

const fetchOrCreateSpaceId = async (): Promise<number> => {
  const url = getRoamUrl();
  const urlParts = url.split("/");
  const name = window.roamAlphaAPI.graph.name;
  const platform: Platform = "Roam";
  const response = await fetch(base_url + "/space", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, name, platform }),
  });
  if (!response.ok)
    throw new Error(
      `Platform API failed: \${response.status} \${response.statusText}`,
    );
  const space = await response.json();
  if (typeof space.id !== "number") throw new Error("API did not return space");
  return space.id;
};

const fetchOrCreatePlatformAccount = async ({
  accountLocalId,
  personName,
  personEmail,
}: {
  accountLocalId: string;
  personName: string;
  personEmail: string | undefined;
}): Promise<number> => {
  const response = await fetch(`${base_url}/platform-account`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      platform: "Roam",
      account_local_id: accountLocalId,
      name: personName,
    }),
  });
  if (!response.ok)
    throw new Error(
      `Platform API failed: \${response.status} \${response.statusText}`,
    );
  const account = await response.json();
  if (personEmail !== undefined) {
    const idResponse = await fetch(`${base_url}/agent-identifier`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: account.id,
        identifier_type: "email",
        value: personEmail,
        trusted: false, // Roam tests email
      }),
    });
    if (!idResponse.ok) {
      const error = await idResponse.text();
      console.error(`Error setting the email for the account: ${error}`);
      // This is not a reason to stop here
    }
  }
  if (typeof account.id !== "number")
    throw new Error("API did not return account");
  return account.id;
};

export const getSupabaseContext = async (): Promise<SupabaseContext | null> => {
  if (CONTEXT_CACHE === null) {
    try {
      const spaceId = await fetchOrCreateSpaceId();
      const accountLocalId = window.roamAlphaAPI.user.uid();
      const personEmail = getCurrentUserEmail();
      const personName = getCurrentUserDisplayName();
      const spacePassword = getOrCreateSpacePassword();
      const userId = await fetchOrCreatePlatformAccount({
        accountLocalId,
        personName,
        personEmail,
      });
      CONTEXT_CACHE = { platform: "Roam", spaceId, userId, spacePassword };
    } catch (error) {
      console.error(error);
      return null;
    }
  }
  return CONTEXT_CACHE;
};
