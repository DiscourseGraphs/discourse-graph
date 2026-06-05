import assert from "assert";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  fetchOrCreateSpaceDirect,
  spaceAnonUserEmail,
} from "@repo/database/lib/contextFunctions";
import type { Database, Json } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { createClient } from "@supabase/supabase-js";
import {
  populate,
  parseJsonLdAsInput,
} from "../../app/utils/conversion/fromJsonLd";
import { JsonLdDocument } from "jsonld";

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

// example data

const jsonLdData: JsonLdDocument = {
  "@context": ["http://localhost:3000/schema/mira.jsonld"],
  "@graph": [
    {
      "@id": "sdata:131157",
      "@type": "NodeSchema",
      modified: "2026-01-24T15:38:14.553Z",
      created: "2026-01-24T15:38:14.553Z",
      subClassOf: ["dgc:Claim", "mira:Claim"],
      label: "Claim",
      creator: "someone",
    },
    {
      "@id": "sdata:254918",
      "@type": ["sdata:131157", "dgc:Claim", "mira:Claim"],
      modified: "2026-05-26T00:39:03.077Z",
      created: "2025-12-04T15:47:51.694Z",
      title: "CLM - Some base claim",
      description: {
        format: "text/html",
        content:
          '<hr />\n<p>nodeTypeId: node<em>OHkZtsR6jkJIVaNmMY</em>GB\nnodeInstanceId: c1f02ff4-f116-452f-a490-3e0309667145</p>\n<h2 id="publishedtogroups">publishedToGroups:</h2>\n<p>That file was empty</p>',
      },
      creator: "someone",
    },
    {
      "@id": "sdata:261134",
      "@type": ["sdata:131157", "dgc:Claim", "mira:Claim"],
      modified: "2026-05-26T00:39:03.077Z",
      created: "2025-12-04T15:47:51.694Z",
      title: "CLM - Some supporting claim",
      creator: "someone",
      description: {
        format: "text/html",
        content: "",
      },
    },
    {
      "@id": "sdata:131164",
      "@type": "AbstractRelationDef",
      modified: "2026-01-24T15:38:14.553Z",
      created: "2026-01-24T15:38:14.553Z",
      subClassOf: [
        "dgb:RelationInstance",
        {
          "@type": "owl:Restriction",
          onProperty: "rdf:predicate",
          hasValue: "sdata:131164",
        },
      ],
      label: "supports",
      creator: "someone",
    },
    {
      "@id": "sdata:131169",
      "@type": "RelationDef",
      modified: "2026-01-24T15:38:14.553Z",
      created: "2026-01-24T15:38:14.553Z",
      domain: "sdata:131157",
      range: "sdata:131157",
      subClassOf: ["sdata:131164"],
      label: "supports",
      creator: "someone",
    },
    {
      "@id": "sdata:261147",
      "@type": "sdata:131164",
      modified: "2026-06-03T10:13:09.101Z",
      created: "2026-06-03T10:13:09.101Z",
      source: "sdata:261134",
      destination: "sdata:254918",
      title:
        "[[CLM - Some supporting claim]] -supports-> [[CLM - Some base claim]]",
      creator: "someone",
    },
  ],
};

describe("Upsert of JSON-LD data", { tags: ["database"] }, () => {
  let spaceId: number;
  let spaceAccountUuid: string;
  let client: DGSupabaseClient;
  let authorAccountId: number;

  beforeAll(async () => {
    const spaceReq = await fetchOrCreateSpaceDirect({
      name: "vitest-spaceReq",
      url: "https://roamresearch.com/#/app/vitest-spaceReq",
      platform: "Roam",
      password: PASSWORD,
    });
    if (!spaceReq.data)
      throw new Error(`Failed to create space 1: ${spaceReq.error?.message}`);
    spaceId = spaceReq.data.id;
    client = await signedInClient(spaceId);
    assert(client);
    const accountReq = await client
      .from("PlatformAccount")
      .select("id,dg_account")
      .eq(
        "account_local_id",
        `roam-${spaceId}-anon@database.discoursegraphs.com`,
      )
      .maybeSingle();
    assert(!accountReq.error);
    assert(accountReq.data);
    assert(accountReq.data.dg_account);
    spaceAccountUuid = accountReq.data.dg_account;
    const authorAccountReq = await client.rpc("upsert_accounts_in_space", {
      accounts: [
        {
          name: "someone",
          account_local_id: "someone",
          platform: "Roam",
          agent_type: "person",
        },
      ],
      space_id_: spaceId,
    });
    console.error(authorAccountReq.error);
    assert(!authorAccountReq.error);
    assert(authorAccountReq.data);
    authorAccountId = authorAccountReq.data[0]!;
  });
  afterAll(async () => {
    if (spaceAccountUuid)
      await serviceClient().auth.admin.deleteUser(spaceAccountUuid);
    if (spaceId) await serviceClient().from("Space").delete().eq("id", spaceId);
    if (authorAccountId)
      await serviceClient()
        .from("PlatformAccount")
        .delete()
        .eq("id", authorAccountId);
  });

  it("Upserts the data", async () => {
    const client = await signedInClient(spaceId);
    const converted = await parseJsonLdAsInput(client, jsonLdData, spaceId);
    console.log(converted);
    const response = await populate(client, jsonLdData, spaceId);
    console.log(response);
    assert(response.length === (jsonLdData["@graph"] as Array<Json>).length);
    assert(Math.min(...response) > 0);
  });
});
