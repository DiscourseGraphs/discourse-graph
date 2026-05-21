import assert from "assert";
import { describe, it, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  fetchOrCreateSpaceDirect,
  spaceAnonUserEmail,
} from "@repo/database/lib/contextFunctions";
import { createGroup } from "../../app/utils/supabase/account";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY!;
const PASSWORD = "abcdefgh";

const freshClient = (): DGSupabaseClient =>
  createClient<Database, "public">(SUPABASE_URL, ANON_KEY);

const serviceClient = () =>
  createClient<Database, "public">(SUPABASE_URL, SERVICE_KEY);

const signedInClient = async (spaceId: number): Promise<DGSupabaseClient> => {
  const client = freshClient();
  const { error } = await client.auth.signInWithPassword({
    email: spaceAnonUserEmail("Roam", spaceId),
    password: PASSWORD,
  });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  return client;
};

describe("list group members flow", { tags: ["database"] }, () => {
  let spaceId1: number;
  let spaceId2: number;
  let spaceAccountUuid1: string;
  let spaceAccountUuid2: string;
  let client1: DGSupabaseClient;
  let client2: DGSupabaseClient;
  let createdGroupId: string | null = null;

  beforeAll(async () => {
    const s1 = await fetchOrCreateSpaceDirect({
      name: "vitest-s1",
      url: "https://roamresearch.com/#/app/vitest-s1",
      platform: "Roam",
      password: PASSWORD,
    });
    if (!s1.data)
      throw new Error(`Failed to create space 1: ${s1.error?.message}`);
    spaceId1 = s1.data.id;
    client1 = await signedInClient(spaceId1);
    assert(client1);
    const accountReq1 = await client1
      .from("PlatformAccount")
      .select("id,dg_account")
      .eq(
        "account_local_id",
        `roam-${spaceId1}-anon@database.discoursegraphs.com`,
      )
      .maybeSingle();
    assert(!accountReq1.error);
    assert(accountReq1.data);
    assert(accountReq1.data.dg_account);
    spaceAccountUuid1 = accountReq1.data.dg_account;
    const s2 = await fetchOrCreateSpaceDirect({
      name: "vitest-s2",
      url: "https://roamresearch.com/#/app/vitest-s2",
      platform: "Roam",
      password: PASSWORD,
    });
    if (!s2.data)
      throw new Error(`Failed to create space 2: ${s2.error?.message}`);
    spaceId2 = s2.data.id;
    client2 = await signedInClient(spaceId2);
    assert(client2);
    const accountReq2 = await client2
      .from("PlatformAccount")
      .select("id,dg_account")
      .eq(
        "account_local_id",
        `roam-${spaceId2}-anon@database.discoursegraphs.com`,
      )
      .maybeSingle();
    assert(!accountReq2.error);
    assert(accountReq2.data);
    assert(accountReq2.data.dg_account);
    spaceAccountUuid2 = accountReq2.data.dg_account;
  });

  afterAll(async () => {
    if (createdGroupId)
      await serviceClient().auth.admin.deleteUser(createdGroupId);
    if (spaceAccountUuid1)
      await serviceClient().auth.admin.deleteUser(spaceAccountUuid1);
    if (spaceAccountUuid2)
      await serviceClient().auth.admin.deleteUser(spaceAccountUuid2);
    if (spaceId1)
      await serviceClient().from("Space").delete().eq("id", spaceId1);
    if (spaceId2)
      await serviceClient().from("Space").delete().eq("id", spaceId2);
  });

  it("lists group members", async () => {
    // Step 1: user1 creates a group
    const groupId = await createGroup(client1, "vitest-invite-group");
    assert(groupId !== null, "createGroup should return a group ID");
    createdGroupId = groupId;

    // Step 2: Add another member
    const { error: errorAddMember } = await client1
      .from("group_membership")
      .insert({
        member_id: spaceAccountUuid2, // eslint-disable-line @typescript-eslint/naming-convention
        group_id: groupId, // eslint-disable-line @typescript-eslint/naming-convention
        admin: false,
      });
    assert(!errorAddMember);

    const groupResponse = await client2.from("my_groups").select();
    assert(!groupResponse.error);
    assert(groupResponse.data !== null);
    assert(groupResponse.data.length === 1);
    assert(groupResponse.data[0]!.id === groupId);
  });
});
