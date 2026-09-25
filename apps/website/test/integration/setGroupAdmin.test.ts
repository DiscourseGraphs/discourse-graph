import assert from "assert";
import { describe, it, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  fetchOrCreateSpaceDirect,
  spaceAnonUserEmail,
} from "@repo/database/lib/contextFunctions";
import { createGroup, setGroupAdmin } from "../../app/utils/supabase/account";

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

const spaceAccountUuid = async (
  client: DGSupabaseClient,
  spaceId: number,
): Promise<string> => {
  const accountReq = await client
    .from("PlatformAccount")
    .select("id,dg_account")
    .eq("account_local_id", `roam-${spaceId}-anon@database.discoursegraphs.com`)
    .maybeSingle();
  assert(!accountReq.error);
  assert(accountReq.data?.dg_account);
  return accountReq.data.dg_account;
};

const adminFlagOf = async (
  client: DGSupabaseClient,
  groupId: string,
  memberId: string,
): Promise<boolean | null> => {
  const req = await client
    .from("group_membership")
    .select("admin")
    .eq("group_id", groupId)
    .eq("member_id", memberId)
    .maybeSingle();
  assert(!req.error, req.error?.message);
  return req.data?.admin ?? null;
};

describe("set group admin flow", { tags: ["database"] }, () => {
  let spaceId1: number;
  let spaceId2: number;
  let spaceAccountUuid1: string;
  let spaceAccountUuid2: string;
  let client1: DGSupabaseClient;
  let client2: DGSupabaseClient;
  let createdGroupId: string | null = null;

  beforeAll(async () => {
    const s1 = await fetchOrCreateSpaceDirect({
      name: "vitest-admin-s1",
      url: "https://roamresearch.com/#/app/vitest-admin-s1",
      platform: "Roam",
      password: PASSWORD,
    });
    if (!s1.data)
      throw new Error(`Failed to create space 1: ${s1.error?.message}`);
    spaceId1 = s1.data.id;
    client1 = await signedInClient(spaceId1);
    spaceAccountUuid1 = await spaceAccountUuid(client1, spaceId1);

    const s2 = await fetchOrCreateSpaceDirect({
      name: "vitest-admin-s2",
      url: "https://roamresearch.com/#/app/vitest-admin-s2",
      platform: "Roam",
      password: PASSWORD,
    });
    if (!s2.data)
      throw new Error(`Failed to create space 2: ${s2.error?.message}`);
    spaceId2 = s2.data.id;
    client2 = await signedInClient(spaceId2);
    spaceAccountUuid2 = await spaceAccountUuid(client2, spaceId2);
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

  it("lets an admin grant and revoke admin rights", async () => {
    const { groupId, error: createError } = await createGroup(
      client1,
      "vitest-admin-group",
    );
    assert(createError === null, createError!);
    assert(groupId !== null, "createGroup should return a group ID");
    createdGroupId = groupId;

    const { error: errorAddMember } = await client1
      .from("group_membership")
      .insert({
        member_id: spaceAccountUuid2,
        group_id: groupId,
        admin: false,
      });
    assert(!errorAddMember);

    // A non-admin cannot promote themselves: the update policy matches no row.
    const selfPromotion = await setGroupAdmin({
      client: client2,
      groupId,
      memberId: spaceAccountUuid2,
      admin: true,
    });
    assert(
      selfPromotion !== null,
      "a member should not be able to self-promote",
    );
    assert(
      (await adminFlagOf(client1, groupId, spaceAccountUuid2)) === false,
      "membership should be unchanged after a refused self-promotion",
    );

    const promotion = await setGroupAdmin({
      client: client1,
      groupId,
      memberId: spaceAccountUuid2,
      admin: true,
    });
    assert(promotion === null, promotion!);
    assert(
      (await adminFlagOf(client1, groupId, spaceAccountUuid2)) === true,
      "member should now be an admin",
    );

    // The granted rights are real, not just a stored flag.
    const demotion = await setGroupAdmin({
      client: client2,
      groupId,
      memberId: spaceAccountUuid1,
      admin: false,
    });
    assert(demotion === null, demotion!);
    assert(
      (await adminFlagOf(client2, groupId, spaceAccountUuid1)) === false,
      "original admin should have been demoted",
    );
  });
});
