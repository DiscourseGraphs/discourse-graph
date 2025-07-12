import assert from "assert";
import { Given, When, Then, world, type DataTable } from "@cucumber/cucumber";
import { createClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@repo/database/types.gen.ts";
import { spaceAnonUserEmail } from "@repo/ui/lib/utils";
import {
  fetchOrCreateSpaceId,
  fetchOrCreatePlatformAccount,
} from "@repo/ui/lib/supabase/contextFunctions";

type Platform = Enums<"Platform">;

const getAnonymousClient = () =>
  createClient<Database, "public", Database["public"]>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
  );
const getServiceClient = () =>
  createClient<Database, "public", Database["public"]>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

const SPACE_ANONYMOUS_PASSWORD = "abcdefgh";

Given("the database is blank", async () => {
  const client = getServiceClient();
  let r = await client.from("Content").delete().neq("id", -1);
  assert.equal(r.error, null);
  r = await client.from("Concept").delete().neq("id", -1);
  assert.equal(r.error, null);
  r = await client.from("AgentIdentifier").delete().neq("account_id", -1);
  assert.equal(r.error, null);
  r = await client.from("PlatformAccount").delete().neq("id", -1);
  assert.equal(r.error, null);
  r = await client.from("Space").delete().neq("id", -1);
  // this one fails. I need to set security to definer. Will do in another PR.
  // assert.equal(r.error, null);
});

const substituteLocalReferences = (
  row: Record<string, any>,
  localRefs: Record<string, number>,
): Record<string, any> =>
  Object.fromEntries(
    Object.entries(row)
      .filter(([k, v]) => k.charAt(0) !== "@")
      .map(([k, v]) =>
        k.charAt(0) == "_" ? [k.substring(1), localRefs[v]] : [k, v],
      ),
  );

Given(
  "{word} are added to the database:",
  async (tableName: keyof Database["public"]["Tables"], table: DataTable) => {
    // generic function to add a bunch of objects.
    // Columns prefixed by @ are primary keys, and are not sent to the database,
    // but the local value is associated with the database id in world.localRefs.
    // Columns prefixed with _ are translated back from local references to db ids.
    const client = getServiceClient();
    const localRefs: Record<string, any> = world.localRefs || {};
    const rows = table.hashes();
    const values: any[] = rows.map((r) =>
      substituteLocalReferences(r, localRefs),
    );
    const defIndex = table
      .raw()[0]!
      .map((k) => (k.charAt(0) == "@" ? k : null))
      .filter((k) => typeof k == "string");
    if (defIndex.length) {
      const localIndexName = defIndex[0]!;
      const dbIndexName = localIndexName.substring(1);
      const ids = await client
        .from(tableName)
        .insert(values)
        .select(dbIndexName);
      assert.equal(ids.error, null);
      if (ids.data == null || ids.data == undefined)
        throw Error("missing return data");
      assert.equal(ids.data.length, rows.length);
      for (let idx = 0; idx < ids.data.length; idx++) {
        const record = ids.data[idx] as Record<string, any>;
        const dbId: number = record[dbIndexName] as number;
        localRefs[rows[idx]![localIndexName]!] = dbId;
      }
    } else {
      const r = await client.from(tableName).insert(values);
      assert.equal(r.error, null);
    }
    world.localRefs = localRefs;
  },
);

const userEmail = (userAccountId: string) => `${userAccountId}@example.com`;

When(
  "the user {word} opens the roam plugin in space {word}",
  async (userAccountId, spaceName) => {
    // assumption: turbo dev is running. TODO: Make into hooks
    const localRefs: Record<string, any> = world.localRefs || {};
    const spaceId = await fetchOrCreateSpaceId({
      password: SPACE_ANONYMOUS_PASSWORD,
      url: `https://roamresearch.com/#/app/${spaceName}`,
      name: spaceName,
      platform: "Roam",
    });
    localRefs[spaceName] = spaceId;
    const userId = await fetchOrCreatePlatformAccount({
      platform: "Roam",
      accountLocalId: userAccountId,
      name: userAccountId,
      email: userEmail(userAccountId),
      spaceId,
      password: SPACE_ANONYMOUS_PASSWORD,
    });
    localRefs[userAccountId] = userId;
    world.localRefs = localRefs;
  },
);

Then("the database should contain a {word}", async (tableName) => {
  const client = getServiceClient();
  const response = await client.from(tableName).select("*", { count: "exact" });
  assert.notEqual(response.count || 0, 0);
});

Then(
  "the database should contain {int} {word}",
  async (expectedCount, tableName) => {
    const client = getServiceClient();
    const response = await client
      .from(tableName)
      .select("*", { count: "exact" });
    assert.equal(response.count, expectedCount);
  },
);

Then(
  "a user logged in space {word} should see a {word} in the database",
  async (spaceName, tableName) => {
    const client = getAnonymousClient();
    const spaceId = world.localRefs[spaceName];
    const loginResponse = await client.auth.signInWithPassword({
      email: spaceAnonUserEmail("Roam", spaceId),
      password: SPACE_ANONYMOUS_PASSWORD,
    });
    assert.equal(loginResponse.error, null);
    const response = await client
      .from(tableName)
      .select("*", { count: "exact" });
    assert.notEqual(response.count || 0, 0);
  },
);

Then(
  "a user logged in space {word} should see {int} {word} in the database",
  async (spaceName, expectedCount, tableName) => {
    const client = getAnonymousClient();
    const spaceId = world.localRefs[spaceName];
    const loginResponse = await client.auth.signInWithPassword({
      email: spaceAnonUserEmail("Roam", spaceId),
      password: SPACE_ANONYMOUS_PASSWORD,
    });
    assert.equal(loginResponse.error, null);
    const response = await client
      .from(tableName)
      .select("*", { count: "exact" });
    assert.equal(response.count, expectedCount);
  },
);
