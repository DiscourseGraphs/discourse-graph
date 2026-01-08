/* eslint @typescript-eslint/no-explicit-any : 0 */
import assert from "assert";
import { Given, When, Then, world, type DataTable } from "@cucumber/cucumber";
import { createClient } from "@supabase/supabase-js";
import {
  Constants,
  type Database,
  type Enums,
  type Json,
} from "@repo/database/dbTypes";
import { getVariant, config } from "@repo/database/dbDotEnv";
import { getConcepts, initNodeSchemaCache } from "@repo/database/lib/queries";

import {
  spaceAnonUserEmail,
  fetchOrCreateSpaceDirect,
  fetchOrCreatePlatformAccount,
} from "@repo/database/lib/contextFunctions";

type Platform = Enums<"Platform">;
type TableName = keyof Database["public"]["Tables"];
const PLATFORMS: readonly Platform[] = Constants.public.Enums.Platform;

if (getVariant() === "production") {
  console.error("Tests are destructive, not running against production");
  process.exit(-1);
}
config();

const getAnonymousClient = () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY",
    );
  }
  return createClient<Database, "public">(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );
};

const getServiceClient = () => {
  // eslint-disable-next-line turboPlugin/no-undeclared-env-vars
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database, "public">(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY, // eslint-disable-line turboPlugin/no-undeclared-env-vars
  );
};

const SPACE_ANONYMOUS_PASSWORD = "abcdefgh";

Given("the database is blank", async () => {
  const client = getServiceClient();
  let r = await client.from("Content").delete().neq("id", -1);
  assert.equal(r.error, null);
  r = await client.from("Document").delete().neq("id", -1);
  assert.equal(r.error, null);
  r = await client.from("Concept").delete().neq("id", -1);
  assert.equal(r.error, null);
  r = await client.from("AgentIdentifier").delete().neq("account_id", -1);
  assert.equal(r.error, null);
  const r3 = await client.from("group_membership").select("group_id");
  assert.equal(r3.error, null);
  const groupIds = new Set((r3.data || []).map(({group_id})=>group_id));
  for (const id of groupIds) {
    const ur = await client.auth.admin.deleteUser(id);
    assert.equal(ur.error, null);
  }
  const r2 = await client.from("PlatformAccount").select("dg_account").not('dg_account', 'is', 'null');
  assert.equal(r2.error, null);
  for (const {dg_account} of r2.data || []) {
    const r = await client.auth.admin.deleteUser(dg_account!);
    assert.equal(r.error, null);
  }
  r = await client.from("PlatformAccount").delete().neq("id", -1);
  assert.equal(r.error, null);
  r = await client.from("Space").delete().neq("id", -1);
  assert.equal(r.error, null);
  world.localRefs = {};
  // clear the cache
  initNodeSchemaCache();
});

const substituteLocalReferences = (
  obj: any,
  localRefs: Record<string, number>,
  prefixValue: boolean = false,
): any => {
  const substituteLocalReferencesRec = (v: any): any => {
    if (v === undefined || v === null) return v;
    if (typeof v === "string") {
      if (prefixValue)
        return v.charAt(0) === "@" ? localRefs[v.substring(1)] : v;
      else return localRefs[v];
    }
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (Array.isArray(v)) return v.map(substituteLocalReferencesRec);
    if (typeof v === "object")
      return Object.fromEntries(
        Object.entries(v as object).map(([k, v]) => [
          k,
          substituteLocalReferencesRec(v),
        ]),
      );
    console.error("could not substitute", typeof v, v);
    return v;
  };
  return substituteLocalReferencesRec(obj);
};

const substituteLocalReferencesRow = (
  row: Record<string, string>,
  localRefs: Record<string, number>,
): Record<string, any> => {
  const processKV = ([k, v]: [string, any]): [string, any] => {
    const isJson = k.charAt(0) === "@";
    if (isJson) {
      k = k.substring(1);
      v = JSON.parse(v as string) as Json;
    }
    if (k.charAt(0) === "_") {
      k = k.substring(1);
      v = substituteLocalReferences(v, localRefs); // eslint-disable-line @typescript-eslint/no-unsafe-assignment
    }
    return [k, v];
  };

  const result = Object.fromEntries(
    Object.entries(row)
      .filter(([k]: [string, string]) => k.charAt(0) !== "$")
      .map(processKV),
  );
  return result;
};

Given(
  "{word} are added to the database:",
  async (tableName: TableName, table: DataTable) => {
    // generic function to add a bunch of objects to an arbitrary table.
    // Columns prefixed by $ are aliases for the primary keys, and are not sent to the database,
    // but the alias name is associated with the database id in world.localRefs.
    // Columns prefixed with _ are translated back from aliases to db ids.
    // Columns prefixed with @ are parsed as json values. (Use @ before _)
    const client = getServiceClient();
    const localRefs = (world.localRefs || {}) as Record<string, number>;
    const rows = table.hashes();
    const values: Record<string, any>[] = rows.map((r) =>
      substituteLocalReferencesRow(r, localRefs),
    );
    const defIndex: string[] = table
      .raw()[0]!
      .map((k) => (k.charAt(0) == "$" ? k : null))
      .filter((k) => typeof k == "string");
    const localIndexName: string = defIndex[0]!;
    // do not allow to redefine values
    assert.strictEqual(
      values.filter((v) =>
        typeof v[localIndexName] === "string"
          ? localRefs[v[localIndexName]] !== undefined
          : false,
      ).length,
      0,
    );
    if (defIndex.length) {
      const dbIndexName = localIndexName.substring(1);
      const ids = await client
        .from(tableName)
        .insert(values as any[])
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
      const r = await client.from(tableName).insert(values as any[]);
      assert.equal(r.error, null);
    }
    world.localRefs = localRefs;
  },
);

const userEmail = (userAccountId: string) => `${userAccountId}@example.com`;

// Invoke the edge function to log an account into a database.
// Use this instead of trying to create spaces directly.
When(
  "the user {word} opens the {word} plugin in space {word}",
  async (userAccountId: string, platform: Platform, spaceName: string) => {
    // assumption: turbo dev is running. TODO: Make into hooks
    if (PLATFORMS.indexOf(platform) < 0)
      throw new Error(`Platform must be one of ${PLATFORMS.join(", ")}`);
    const localRefs = (world.localRefs || {}) as Record<string, number>;
    const spaceResponse = await fetchOrCreateSpaceDirect({
      password: SPACE_ANONYMOUS_PASSWORD,
      url: `https://roamresearch.com/#/app/${spaceName}`,
      name: spaceName,
      platform,
    });
    if (!spaceResponse.data)
      throw new Error(
        `Could not create space: ${JSON.stringify(spaceResponse.error)}`,
      );
    const spaceId = spaceResponse.data.id;
    localRefs[spaceName] = spaceId;
    const userId = await fetchOrCreatePlatformAccount({
      platform,
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

// A test of non-empty object count for the named table
Then("the database should contain a {word}", async (tableName: TableName) => {
  const client = getServiceClient();
  const response = await client.from(tableName).select("*", { count: "exact" });
  assert.notEqual(response.count || 0, 0);
});

// A test of absolute object count for the named table
Then(
  "the database should contain {int} {word}",
  async (expectedCount: number, tableName: TableName) => {
    const client = getServiceClient();
    const response = await client
      .from(tableName)
      .select("*", { count: "exact" });
    assert.equal(response.count, expectedCount);
  },
);

const getLoggedinDatabase = async (spaceId: number) => {
  assert.notStrictEqual(spaceId, undefined);
  const client = getAnonymousClient();
  const loginResponse = await client.auth.signInWithPassword({
    email: spaceAnonUserEmail("Roam", spaceId),
    password: SPACE_ANONYMOUS_PASSWORD,
  });
  assert.equal(loginResponse.error, null);
  return client;
};

// A test of non-empty object count for the named table, as seen by the user
Then(
  "a user logged in space {word} should see a {word} in the database",
  async (spaceName: string, tableName: TableName) => {
    const localRefs = (world.localRefs || {}) as Record<string, number>;
    const spaceId = localRefs[spaceName];
    if (spaceId === undefined) assert.fail("spaceId");
    const client = await getLoggedinDatabase(spaceId);
    const response = await client
      .from(tableName)
      .select("*", { count: "exact" });
    assert.notEqual(response.count || 0, 0);
  },
);

// A test of exact object count for the named table, as seen by the user
Then(
  "a user logged in space {word} should see {int} {word} in the database",
  async (spaceName: string, expectedCount: number, tableName: TableName) => {
    const localRefs = (world.localRefs || {}) as Record<string, number>;
    const spaceId = localRefs[spaceName];
    if (spaceId === undefined) assert.fail("spaceId");
    const client = await getLoggedinDatabase(spaceId);
    const response = await client
      .from(tableName)
      .select("*", { count: "exact" });
    assert.equal(response.count, expectedCount);
  },
);

// invoke the upsert_accounts_in_space function, expects json
Given(
  "user {word} upserts these accounts to space {word}:",
  async (userName: string, spaceName: string, accountsString: string) => {
    const accounts = JSON.parse(accountsString) as Json;
    const localRefs = (world.localRefs || {}) as Record<string, number>;
    const spaceId = localRefs[spaceName];
    if (spaceId === undefined) assert.fail("spaceId");
    const client = await getLoggedinDatabase(spaceId);
    const response = await client.rpc("upsert_accounts_in_space", {
      space_id_: spaceId, // eslint-disable-line @typescript-eslint/naming-convention
      accounts,
    });
    assert.equal(response.error, null);
  },
);

// invoke the upsert_documents function, expects json
Given(
  "user {word} upserts these documents to space {word}:",
  async (userName: string, spaceName: string, docString: string) => {
    const data = JSON.parse(docString) as Json;
    const localRefs = (world.localRefs || {}) as Record<string, number>;
    const spaceId = localRefs[spaceName];
    if (spaceId === undefined) assert.fail("spaceId");
    const client = await getLoggedinDatabase(spaceId);
    const response = await client.rpc("upsert_documents", {
      v_space_id: spaceId, // eslint-disable-line @typescript-eslint/naming-convention
      data,
    });
    assert.equal(response.error, null);
  },
);

// invoke the upsert_content function, expects json
Given(
  "user {word} upserts this content to space {word}:",
  async (userName: string, spaceName: string, docString: string) => {
    const data = JSON.parse(docString) as Json;
    const localRefs = (world.localRefs || {}) as Record<string, number>;
    const spaceId = localRefs[spaceName];
    if (spaceId === undefined) assert.fail("spaceId");
    const userId = localRefs[userName];
    if (userId === undefined) assert.fail("userId");
    const client = await getLoggedinDatabase(spaceId);
    const response = await client.rpc("upsert_content", {
      v_space_id: spaceId, // eslint-disable-line @typescript-eslint/naming-convention
      data,
      v_creator_id: userId, // eslint-disable-line @typescript-eslint/naming-convention
      content_as_document: false, // eslint-disable-line @typescript-eslint/naming-convention
    });
    assert.equal(response.error, null);
  },
);

// invoke the upsert_concepts function, expects json
Given(
  "user {word} upserts these concepts to space {word}:",
  async (userName: string, spaceName: string, docString: string) => {
    const data = JSON.parse(docString) as Json;
    const localRefs = (world.localRefs || {}) as Record<string, number>;
    const spaceId = localRefs[spaceName];
    if (spaceId === undefined) assert.fail("spaceId");
    const client = await getLoggedinDatabase(spaceId);
    const response = await client.rpc("upsert_concepts", {
      v_space_id: spaceId, // eslint-disable-line @typescript-eslint/naming-convention
      data,
    });
    assert.equal(response.error, null);
  },
);

Given(
  "a user logged in space {word} and calling getConcepts with these parameters: {string}",
  async (spaceName: string, paramsJ: string) => {
    // params are assumed to be Json. Values prefixed with '@' are interpreted as aliases.
    const localRefs = (world.localRefs || {}) as Record<string, number>;
    const params = substituteLocalReferences(
      JSON.parse(paramsJ),
      localRefs,
      true,
    ) as object;
    const spaceId = localRefs[spaceName];
    if (spaceId === undefined) assert.fail("spaceId");
    const supabase = await getLoggedinDatabase(spaceId);
    // note that we supply spaceId and supabase, they do not need to be part of the incoming Json
    const nodes = await getConcepts({ ...params, supabase, spaceId });
    nodes.sort((a, b) => a.id! - b.id!);
    world.queryResults = nodes;
  },
);

type ObjectWithId = object & { id: number };

Then("query results should look like this", (table: DataTable) => {
  const localRefs = (world.localRefs || {}) as Record<string, number>;
  const rows = table.hashes();
  const values = rows.map((r) =>
    substituteLocalReferencesRow(r, localRefs),
  ) as ObjectWithId[];
  // console.debug(values);
  // console.debug(JSON.stringify(world.queryResults, null, 2));
  const queryResults = (world.queryResults || []) as ObjectWithId[];
  values.sort((a, b) => a.id - b.id);
  assert.deepEqual(
    queryResults.map((v) => v.id),
    values.map((v) => v.id),
  );
  if (values.length > 0) {
    const keys = Object.keys(values[0]!);
    const truncatedResults = queryResults.map((v: object) =>
      Object.fromEntries(Object.entries(v).filter(([k]) => keys.includes(k))),
    );
    // console.debug(truncatedResults);
    assert.deepEqual(truncatedResults, values);
  }
});

When("user of space {word} creates group {word}", async (spaceName: string, name: string)=>{
  const localRefs = (world.localRefs || {}) as Record<string, number|string>;
  const spaceId = localRefs[spaceName];
  if (spaceId === undefined) assert.fail("spaceId");
  const client = await getLoggedinDatabase(spaceId as number);
  try{
    const response = await client.functions.invoke<{group_id: string}>("create-group", {body:{name}});
    assert.equal(response.error, null);
    localRefs[name] = response.data!.group_id;
  } catch (error) {
    console.error((error as any).actual);
    throw error;
  }
})

When("user of space {word} adds space {word} to group {word}",
    async (space1Name: string, space2Name:string, groupName: string)=>{
  const localRefs = (world.localRefs || {}) as Record<string, number|string>;
  const space1Id = localRefs[space1Name] as number;
  const space2Id = localRefs[space2Name] as number;
  const groupId = localRefs[groupName] as string;
  if (space1Id === undefined) assert.fail("space1Id");
  if (space2Id === undefined) assert.fail("space2Id");
  if (groupId === undefined) assert.fail("groupId");
  const client1 = await getLoggedinDatabase(space1Id as number);
  const client2 = await getLoggedinDatabase(space2Id as number);
  const r1 = await client2.from("PlatformAccount").select("dg_account").eq("account_local_id", spaceAnonUserEmail("Roam", space2Id)).maybeSingle();
  assert.equal(r1.error, null);
  const memberId = r1.data?.dg_account;
  assert(!!memberId);
  const r2 = await client1.from("group_membership").insert({
    group_id: groupId,
    member_id: memberId!
  });
  assert.equal(r2.error, null);
})
