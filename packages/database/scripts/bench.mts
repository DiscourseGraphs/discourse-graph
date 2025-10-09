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

import { getConcepts, LAST_QUERY_DATA } from "@repo/database/lib/queries";
import { createClient } from "@repo/database/lib/client";
import { config } from "@repo/database/dbDotEnv";
import {
  fetchOrCreateSpaceDirect,
  createLoggedInClient,
} from "@repo/database/lib/contextFunctions";

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
const queries = [
  { schemaLocalIds: [], fetchNodes: true }, // all nodes
  { schemaLocalIds: [], fetchNodes: false }, // all relations
  { fetchNodes: null, fetchNodes: null }, // all schemas
  { schemaLocalIds: ["claim"] }, // all nodes of a given type
  { nodeAuthor: "account_2", schemaLocalIds: [], fetchNodes: null }, // all nodes of an author
  { inRelsOfTypeLocal: ["opposes"], schemaLocalIds: [] }, // all nodes in relation to a relation type
  { inRelsToNodesOfTypeLocal: ["hypothesis"], schemaLocalIds: [] }, // all nodes in relation to a node type
  {
    schemaLocalIds: [],
    inRelsToNodesOfAuthor: "account_3",
    relationFields: ["id"] as any,
    relationSubNodesFields: ["id"] as any,
  }, // in relation to nodes with a certain author
  // { schemaLocalIds: [], inRelsToNodeLocalIds: ["claim_10"] }, // relation to a specific node. this test would need all node to have backing content
];
const benches = [];
for (const query of queries) {
  const query2 = { ...query, supabase, spaceId };
  const concepts = await getConcepts(query2);
  benches.push({ query, ...LAST_QUERY_DATA, concepts });
  console.log(`Query ${LAST_QUERY_DATA.duration}ms: ${JSON.stringify(query)}`);
}
