// steps that remain to automate:
// 1. Stop the local supabase
// 2. Set the environment variable SUPABASE_PROJECT_ID=benchmarks
// 2. Start a new supabase instance with this project_id
// 3. populate with `python benchmark.py benchmark.yaml`
// 4. Run turbo dev on the side (with the same environment)
// 5. pnpm run bench
// 6. Optional: supabase db reset to release space
// 7. stop supabase
// 8. Ensure the environment is back to normal.

import {
  getConcepts,
  getSchemaConcepts,
  LAST_QUERY_DATA,
} from "@repo/database/lib/queries";
import { createClient } from "@repo/database/lib/client";
import { config } from "@repo/database/dbDotEnv";
import type { Tables } from "@repo/database/dbTypes";
import {
  fetchOrCreateSpaceDirect,
  createLoggedInClient,
} from "@repo/database/lib/contextFunctions";

type ConceptKA = (keyof Tables<"Concept">)[];

config();
const platform = "Roam";
let supabase = createClient();
if (!supabase) process.exit(1);
const { data, error } = await fetchOrCreateSpaceDirect({
  url: "test",
  name: "test",
  platform,
  password: "password",
});
if (error || !data || !data.id) {
  console.error("Could not create space connection", error);
  process.exit(1);
}
const spaceId = data.id;
supabase = await createLoggedInClient(platform, spaceId, "password");
if (!supabase) process.exit(1);
/* eslint-disable @typescript-eslint/naming-convention */
const queries = {
  "Query all nodes": { schemaLocalIds: [], fetchNodes: true },
  "Query all relations": { schemaLocalIds: [], fetchNodes: false },
  "Query all node and relation schemas": { fetchNodes: null },
  "Query all nodes of a given type": { schemaLocalIds: ["claim"] },
  "Query all nodes and relations by a given author": {
    nodeAuthor: "account_2",
    schemaLocalIds: [],
    fetchNodes: null,
  },
  "Query all nodes in a relation of a given type": {
    inRelsOfTypeLocal: ["opposes"],
    schemaLocalIds: [],
  },
  "Query all nodes in some relation to another node of a given type": {
    inRelsToNodesOfTypeLocal: ["hypothesis"],
    schemaLocalIds: [],
  },
  // Previous will be slow, more efficient to filter on base node, and in some relation, as follows:
  "Query all nodes of a given type in some relation": {
    schemaLocalIds: ["hypothesis"],
    relationFields: ["id"] as ConceptKA,
  },
  "Query all nodes in some relation to a node of a certain author": {
    schemaLocalIds: [],
    inRelsToNodesOfAuthor: "account_3",
    relationFields: ["id"] as ConceptKA,
    relationSubNodesFields: ["id"] as ConceptKA,
  },
  // Previous will be slow, more efficient to start on given type, and in some relation, as follows:
  "Query all nodes of a certain author in some relation": {
    schemaLocalIds: [],
    nodeAuthor: "account_3",
    relationFields: ["id"] as ConceptKA,
    relationSubNodesFields: ["id"] as ConceptKA,
  },
  "In relation to a specific node.": {
    schemaLocalIds: [],
    inRelsToNodeLocalIds: ["claim_11"],
  }, //  this test is excruciatingly slow
  "A specific node's relation.": {
    schemaLocalIds: [],
    baseNodeLocalIds: ["claim_11"],
    relationFields: ["id"] as ConceptKA,
    relationSubNodesFields: ["id"] as ConceptKA,
  },
};
/* eslint-enable @typescript-eslint/naming-convention */
await getSchemaConcepts(supabase, spaceId, true);
const benches = [];
for (const [description, query] of Object.entries(queries)) {
  const query2 = { ...query, supabase, spaceId };
  const concepts = await getConcepts(query2);
  benches.push({ description, query, ...LAST_QUERY_DATA, concepts });
  console.log(
    `${LAST_QUERY_DATA.duration}ms: ${description}\n  ${concepts.length} results from ${JSON.stringify(query)}`,
  );
}
