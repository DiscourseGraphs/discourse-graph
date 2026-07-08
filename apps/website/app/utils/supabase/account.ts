import type { Database } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";

type AgentType = Database["public"]["Enums"]["AgentType"] | "group";

export const getAccountId = async (
  client: DGSupabaseClient,
): Promise<number | undefined> => {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return undefined;
  const userData = data.user;
  if (typeof userData.id !== "string") return undefined;
  const id = userData.id;
  const accountReq = await client
    .from("PlatformAccount")
    .select("id")
    .eq("dg_account", id)
    .eq("agent_type", "person")
    .maybeSingle();
  return accountReq.data?.id;
};

export const getSessionBaseUserData = async (
  client: DGSupabaseClient,
): Promise<{
  id: string;
  name?: string;
  type: AgentType;
  email?: string;
} | null> => {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  const userData = data.user;
  if (typeof userData.id !== "string") return null;
  const { id, email }: { id: string; email?: string } = userData;
  if (email) {
    const [name, host] = email.split("@") as [string, string];
    if (host === "database.discoursegraphs.com" && name.endsWith("-anon")) {
      const parts = name.split("-");
      const spaceId = Number.parseInt(parts[1]!);
      if (Number.isNaN(spaceId)) return null;
      const spaceReq = await client
        .from("Space")
        .select("name")
        .eq("id", spaceId)
        .maybeSingle();
      if (spaceReq.error || !spaceReq.data) {
        return null;
      }
      return { name: spaceReq.data.name, id, type: "anonymous", email };
    }
    if (host === "groups.discoursegraphs.com") {
      return { name, id, email, type: "group" };
    }
  }
  return { id, type: "person", email };
};

export const getSessionUserData = async (
  client: DGSupabaseClient,
): Promise<{
  id: string;
  name: string;
  type: AgentType;
  email?: string;
} | null> => {
  const data = await getSessionBaseUserData(client);
  if (data === null) return null;
  if (!data.name && data.type === "person") {
    const accountReq = await client
      .from("PlatformAccount")
      .select("name")
      .eq("dg_account", data.id)
      .eq("agent_type", "person")
      .maybeSingle();
    if (accountReq.error || !accountReq.data?.name) {
      return null;
    }
    return { ...data, name: accountReq.data.name };
  }
  const { name } = data;
  if (name === undefined) return null;
  if (data.name === undefined) return null;
  return { ...data, name };
};

export const createGroupInvitation = async ({
  client,
  groupId,
  admin = false,
}: {
  client: DGSupabaseClient;
  groupId: string;
  admin?: boolean;
}): Promise<string | null> => {
  const userData = await getSessionBaseUserData(client);
  if (!userData) return null;
  const membershipReq = await client
    .from("group_membership")
    .select("admin")
    .eq("group_id", groupId)
    .eq("member_id", userData.id)
    .maybeSingle();
  if (membershipReq.data?.admin !== true) return null;
  const { data, error } = await client.rpc("create_secret_token", {
    v_payload: { groupId, type: "groupInvitation", admin },
    expiry_interval: "60d",
  });
  if (error || !data) return null;
  return data;
};

export const acceptGroupInvitation = async (
  client: DGSupabaseClient,
  token: string,
): Promise<string | null> => {
  const userData = await getSessionBaseUserData(client);
  if (!userData) return "Not logged in";
  const { data, error } = await client.rpc("accept_group_invitation", {
    token,
  });
  if (error) return error.message || "Unknown error";
  if (!data) return "Unable to accept invitation";
  return null;
};

export const createGroup = async (
  client: DGSupabaseClient,
  name: string,
): Promise<{ groupId: string | null; error: string | null }> => {
  const result = await client.functions.invoke<{ group_id: string }>(
    "create-group",
    { body: { name } },
  );
  if (result.error) {
    let message =
      typeof result.error === "string"
        ? result.error
        : (result.error as { message: string }).message;
    try {
      const body = (await (
        result.error as { context?: Response }
      ).context?.json()) as { msg?: string } | undefined;
      if (body?.msg) message = body.msg;
    } catch {
      // ignore parse errors
    }
    return { groupId: null, error: message };
  }
  return { groupId: result.data?.group_id ?? null, error: null };
};

export const removeFromGroup = async ({
  client,
  groupId,
  memberId,
}: {
  client: DGSupabaseClient;
  groupId: string;
  memberId?: string;
}): Promise<string | null> => {
  if (memberId === undefined) {
    const userData = await getSessionBaseUserData(client);
    memberId = userData?.id ?? undefined;
    if (memberId === undefined) return "Not logged in";
  }
  const response = await client
    .from("group_membership")
    .delete()
    .eq("member_id", memberId)
    .eq("group_id", groupId)
    .select();
  if (response.error) return response.error.message;
  if (response.data === null || response.data.length === 0)
    return "No such record";

  return null; // success
};
