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

type GroupSpaceInfo = Database["public"]["CompositeTypes"]["group_space_info"];

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

    const expectedSpaceIds = [spaceId1, spaceId2];
    // Step 3: user1 lists group members
    const { data: data1, error: error1 } = await client1.rpc(
      "spaces_in_group",
      {
        p_group_id: createdGroupId, // eslint-disable-line @typescript-eslint/naming-convention
      },
    );

    assert(error1 === null, error1 ? error1.message : "");
    assert(data1 !== null, "group spaces should not be empty");
    assert(data1.length === 2, "There should be two spaces");
    const spacesSeenBy1 = Object.fromEntries(
      data1.filter((gm) => gm.id !== null).map((gm) => [gm.id, gm]),
    ) as Record<number, GroupSpaceInfo>;
    assert(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expectedSpaceIds.every((id) => spacesSeenBy1[id] !== undefined),
      "Wrong membership information",
    );
    assert(
      Object.values(spacesSeenBy1).every(
        (gm) => gm.sharing_permissions === null,
      ),
    );
    // Step 4: user2 lists group members
    const { data: data2, error: error2 } = await client2.rpc(
      "spaces_in_group",
      {
        p_group_id: createdGroupId, // eslint-disable-line @typescript-eslint/naming-convention
      },
    );
    assert(error2 === null, error2 ? error2.message : "");
    assert(data2 !== null, "group spaces should not be empty");
    assert(data2.length === 2, "There should be two spaces");
    const spacesSeenBy2 = new Set(
      data2.map((gm) => gm.id).filter((id) => id !== null),
    );
    assert(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expectedSpaceIds.every((id) => spacesSeenBy2.has(id)),
      "Wrong membership information",
    );

    // Step 5: User 2 publishes a space
    const { error: errorPublishSpace2 } = await client2
      .from("SpaceAccess")
      .insert({
        space_id: spaceId2, // eslint-disable-line @typescript-eslint/naming-convention
        account_uid: groupId, // eslint-disable-line @typescript-eslint/naming-convention
        permissions: "partial",
      });
    assert(!errorPublishSpace2);
    // Step 6: that space is now seen as published by 1.
    const { data: data1b, error: error1b } = await client1.rpc(
      "spaces_in_group",
      {
        p_group_id: createdGroupId, // eslint-disable-line @typescript-eslint/naming-convention
      },
    );

    assert(error1b === null, error1b ? error1b.message : "");
    assert(data1b !== null, "group spaces should not be empty");
    assert(data1b.length === 2, "There should be two spaces");
    const spacesSeenBy1b = Object.fromEntries(
      data1b.filter((gm) => gm.id !== null).map((gm) => [gm.id, gm]),
    ) as Record<number, GroupSpaceInfo>;
    assert(
      spacesSeenBy1b[spaceId2]?.sharing_permissions,
      "Second space should now be seen as shared",
    );
  });
});
