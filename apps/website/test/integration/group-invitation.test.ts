import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  fetchOrCreateSpaceDirect,
  fetchOrCreatePlatformAccount,
  spaceAnonUserEmail,
} from "@repo/database/lib/contextFunctions";
import {
  createGroup,
  createGroupInvitation,
  acceptGroupInvitation,
} from "../../app/utils/supabase/account";

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

describe("group invitation flow (website functions)", () => {
  let spaceId1: number;
  let spaceId2: number;
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
    await fetchOrCreatePlatformAccount({
      platform: "Roam",
      accountLocalId: "vitest-user1",
      name: "vitest-user1",
      email: "vitest-user1@example.com",
      spaceId: spaceId1,
      password: PASSWORD,
    });

    const s2 = await fetchOrCreateSpaceDirect({
      name: "vitest-s2",
      url: "https://roamresearch.com/#/app/vitest-s2",
      platform: "Roam",
      password: PASSWORD,
    });
    if (!s2.data)
      throw new Error(`Failed to create space 2: ${s2.error?.message}`);
    spaceId2 = s2.data.id;
    await fetchOrCreatePlatformAccount({
      platform: "Roam",
      accountLocalId: "vitest-user2",
      name: "vitest-user2",
      email: "vitest-user2@example.com",
      spaceId: spaceId2,
      password: PASSWORD,
    });

    client1 = await signedInClient(spaceId1);
    client2 = await signedInClient(spaceId2);
  });

  afterAll(async () => {
    if (createdGroupId) {
      await serviceClient().auth.admin.deleteUser(createdGroupId);
    }
  });

  it("executes the full invitation flow", async () => {
    // Step 1: user1 creates a group
    const groupId = await createGroup(client1, "vitest-invite-group");
    expect(groupId, "createGroup should return a group ID").toBeTruthy();
    createdGroupId = groupId;

    // Step 2: user1 creates an invitation token
    const token = await createGroupInvitation({
      client: client1,
      groupId: groupId!,
      admin: false,
    });
    expect(token, "createGroupInvitation should return a token").toBeTruthy();

    // Step 3: user2 accepts the invitation
    const error = await acceptGroupInvitation(client2, token!);
    expect(
      error,
      "acceptGroupInvitation should return null on success",
    ).toBeNull();

    // Step 4: verify user2 is in group_membership
    const { data: user2 } = await client2.auth.getUser();
    const { data: membership } = await serviceClient()
      .from("group_membership")
      .select("admin")
      .eq("group_id", groupId!)
      .eq("member_id", user2.user!.id)
      .maybeSingle();
    expect(membership, "user2 should appear in group_membership").toBeTruthy();
    expect(membership?.admin).toBe(false);
  });
});
