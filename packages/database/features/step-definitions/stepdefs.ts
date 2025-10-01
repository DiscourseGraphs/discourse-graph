import assert from "assert";
import { Given, When, Then, world, type DataTable } from "@cucumber/cucumber";
import { createClient } from "@supabase/supabase-js";
import { Constants, type Database, type Enums } from "@repo/database/dbTypes";
import { getVariant, config } from "@repo/database/dbDotEnv";
import { getNodes, initNodeSchemaCache } from "@repo/database/lib/queries";

import {
  spaceAnonUserEmail,
  fetchOrCreateSpaceDirect,
  fetchOrCreatePlatformAccount,
} from "@repo/database/lib/contextFunctions";

type Platform = Enums<"Platform">;
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
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database, "public">(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
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
  r = await client.from("PlatformAccount").delete().neq("id", -1);
  assert.equal(r.error, null);
  r = await client.from("Space").delete().neq("id", -1);
  assert.equal(r.error, null);
  world.localRefs = {};
  // clear the cache
  initNodeSchemaCache();
});

const substituteLocalReferences = (
  row: Record<string, string>,
  localRefs: Record<string, number>,
): Record<string, any> => {
  const substituteLocalReferencesRec = (v: any): any => {
    if (typeof v === "string") {
      return localRefs[v];
    }
    if (Array.isArray(v)) return v.map(substituteLocalReferencesRec);
    if (typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, v]) => [k, substituteLocalReferencesRec(v)]),
      );
    console.error("could not substitute", typeof v, v);
  };

  const processKV = ([k, v]: [string, any]) => {
    let v2: any = v;
    const isJson = k.charAt(0) === "@";
    if (isJson) {
      k = k.substring(1);
      v2 = JSON.parse(v2);
    }
    if (k.charAt(0) === "_") {
      k = k.substring(1);
      v2 = substituteLocalReferencesRec(v2);
    }
    return [k, v2];
  };

  const result = Object.fromEntries(
    Object.entries(row)
      .filter(([k, v]: [string, string]) => k.charAt(0) !== "$")
      .map(processKV),
  );
  return result;
};

Given(
  "{word} are added to the database:",
  async (tableName: keyof Database["public"]["Tables"], table: DataTable) => {
    // generic function to add a bunch of objects.
    // Columns prefixed by $ are primary keys, and are not sent to the database,
    // but the local value is associated with the database id in world.localRefs.
    // Columns prefixed with _ are translated back from local references to db ids.
    // Columns prefixed with @ are parsed as json values. (Use @ before _)
    const client = getServiceClient();
    const localRefs = (world.localRefs as Record<string, number>) || {};
    const rows = table.hashes();
    const values: any[] = rows.map((r) =>
      substituteLocalReferences(r, localRefs),
    );
    const defIndex = table
      .raw()[0]!
      .map((k) => (k.charAt(0) == "$" ? k : null))
      .filter((k) => typeof k == "string");
    const localIndexName = defIndex[0]!;
    // do not allow to redefine values
    assert.strictEqual(
      values.filter((v) => localRefs[v[localIndexName]] !== undefined).length,
      0,
    );
    if (defIndex.length) {
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
  "the user {word} opens the {word} plugin in space {word}",
  async (userAccountId, platform, spaceName) => {
    // assumption: turbo dev is running. TODO: Make into hooks
    if (PLATFORMS.indexOf(platform) < 0)
      throw new Error(`Platform must be one of ${PLATFORMS}`);
    const localRefs = (world.localRefs as Record<string, number>) || {};
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

Then(
  "a user logged in space {word} should see a {word} in the database",
  async (spaceName, tableName) => {
    const spaceId: number = world.localRefs[spaceName];
    const client = await getLoggedinDatabase(spaceId);
    const response = await client
      .from(tableName)
      .select("*", { count: "exact" });
    assert.notEqual(response.count || 0, 0);
  },
);

Then(
  "a user logged in space {word} should see {int} {word} in the database",
  async (spaceName, expectedCount, tableName) => {
    const spaceId: number = world.localRefs[spaceName];
    const client = await getLoggedinDatabase(spaceId);
    const response = await client
      .from(tableName)
      .select("*", { count: "exact" });
    assert.equal(response.count, expectedCount);
  },
);

Given(
  "user {word} upserts these accounts to space {word}:",
  async (userName: string, spaceName: string, accountsString: string) => {
    const accounts = JSON.parse(accountsString);
    const spaceId: number = world.localRefs[spaceName];
    const client = await getLoggedinDatabase(spaceId);
    const response = await client.rpc("upsert_accounts_in_space", {
      space_id_: spaceId,
      accounts,
    });
    assert.equal(response.error, null);
  },
);

Given(
  "user {word} upserts these documents to space {word}:",
  async (userName: string, spaceName: string, docString: string) => {
    const data = JSON.parse(docString);
    const spaceId: number = world.localRefs[spaceName];
    const client = await getLoggedinDatabase(spaceId);
    const response = await client.rpc("upsert_documents", {
      v_space_id: spaceId,
      data,
    });
    assert.equal(response.error, null);
  },
);

Given(
  "user {word} upserts this content to space {word}:",
  async (userName: string, spaceName: string, docString: string) => {
    const data = JSON.parse(docString);
    const spaceId: number = world.localRefs[spaceName];
    const client = await getLoggedinDatabase(spaceId);
    const response = await client.rpc("upsert_content", {
      v_space_id: spaceId,
      data,
      v_creator_id: world.localRefs[userName],
      content_as_document: false,
    });
    assert.equal(response.error, null);
  },
);

Given(
  "user {word} upserts these concepts to space {word}:",
  async (userName: string, spaceName: string, docString: string) => {
    const data = JSON.parse(docString);
    const spaceId: number = world.localRefs[spaceName];
    const client = await getLoggedinDatabase(spaceId);
    const response = await client.rpc("upsert_concepts", {
      v_space_id: spaceId,
      data,
    });
    assert.equal(response.error, null);
  },
);

Given(
  "a user logged in space {word} and querying nodes with these parameters: {string}",
  async (spaceName: string, paramsJ: string) => {
    const params = JSON.parse(paramsJ);
    const spaceId: number = world.localRefs[spaceName];
    const supabase = await getLoggedinDatabase(spaceId);
    const nodes = await getNodes({ ...params, supabase, spaceId });
    nodes.sort((a, b) => a.id! - b.id!);
    world.queryResults = nodes;
  },
);

Then("query results should look like this", (table: DataTable) => {
  const localRefs = (world.localRefs as Record<string, number>) || {};
  const rows = table.hashes();
  const values: any[] = rows.map((r) =>
    substituteLocalReferences(r, localRefs),
  );
  // console.debug(values);
  // console.debug(JSON.stringify(world.queryResults, null, 2));
  values.sort((a, b) => a.id! - b.id!);
  assert.deepEqual(
    world.queryResults.map((v: any) => v.id),
    values.map((v) => v.id),
  );
  if (values.length) {
    const keys = Object.keys(values[0]);
    const truncatedResults = world.queryResults.map((v: any) =>
      Object.fromEntries(
        Object.entries(v).filter(([k, _]) => keys.includes(k)),
      ),
    );
    // console.debug(truncatedResults);
    assert.deepEqual(truncatedResults, values);
  }
});
