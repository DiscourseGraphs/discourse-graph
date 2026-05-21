import type { Database } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";

type AgentType = Database["public"]["Enums"]["AgentType"] | "group";

export const getSessionUserData = async (
  client: DGSupabaseClient,
): Promise<{
  id: string;
  name: string;
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
  const accountReq = await client
    .from("PlatformAccount")
    .select("name")
    .eq("dg_account", id)
    .eq("agent_type", "person")
    .maybeSingle();
  if (accountReq.error || !accountReq.data) {
    return null;
  }
  return { id, name: accountReq.data.name, type: "person", email };
};

export const createGroup = async (
  client: DGSupabaseClient,
  name: string,
): Promise<string | null> => {
  const result = await client.functions.invoke<{ group_id: string }>(
    "create-group",
    { body: { name } },
  );
  return result.data?.group_id || null;
};
