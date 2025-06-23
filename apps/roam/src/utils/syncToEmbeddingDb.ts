import isDiscourseNode from "./isDiscourseNode";
import { getEmbeddingsService } from "./embeddingService";
import getCurrentUserEmail from "roamjs-components/queries/getCurrentUserEmail";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";

// Type for results from the Roam Datalog query
type RoamEntityFromQuery = {
  ":block/uid": string;
  ":node/title"?: string;
  ":block/string"?: string;
  ":edit/time"?: number;
  ":create/time"?: number;
};

// Moved API_BASE_URL to be a module-level constant
const API_BASE_URL =
  "https://discourse-graph-git-store-in-supabase-discourse-graphs.vercel.app";

type RoamContentNode = {
  uid: string;
  string: string; // Primary text content for embedding - THIS WILL BE THE TITLE
  "edit/time"?: number;
  "create/time"?: number;
};

type RoamContentNodeSet = {
  updatedNodesSince: RoamContentNode[];
  allNodesInGraph: RoamContentNode[];
};

export async function getAllDiscourseNodes(
  since: number,
): Promise<RoamContentNodeSet> {
  // We are using a forked version of findDiscouseNode that uses the title instead of the uid
  // because uid runs query for every node, and is too slow.

  const roamAlpha = (window as any).roamAlphaAPI;
  console.log("since", since);

  // Query for nodes updated since the given timestamp
  const updatedQuery =
    "[:find (pull ?e [:block/uid :node/title :edit/time :create/time]) :in $ ?since :where [?e :node/title] [?e :edit/time ?edit-time] [(> ?edit-time ?since)]]";

  // Query for all discourse nodes in the graph (no time filter)
  const allQuery =
    "[:find (pull ?e [:block/uid :node/title :edit/time :create/time]) :where [?e :node/title]]";

  const updatedQueryResult = roamAlpha.data.fast.q(updatedQuery, since) as [
    RoamEntityFromQuery,
  ][];

  const allQueryResult = roamAlpha.data.fast.q(allQuery) as [
    RoamEntityFromQuery,
  ][];

  console.log(
    "Raw updated query result:",
    JSON.stringify(updatedQueryResult, null, 2),
  );

  const processEntities = (queryResult: [RoamEntityFromQuery][]) => {
    return queryResult
      .map(([entity]) => {
        return entity;
      })
      .filter(
        (entity) =>
          entity[":block/uid"] &&
          isDiscourseNode(entity[":block/uid"]) &&
          entity[":node/title"] &&
          entity[":node/title"]!.trim() !== "",
      )
      .map((entity) => ({
        uid: entity[":block/uid"],
        string: entity[":node/title"]!.trim(),
        "edit/time": entity[":edit/time"],
        "create/time": entity[":create/time"],
      }));
  };

  const updatedNodesSince = processEntities(updatedQueryResult);
  const allNodesInGraph = processEntities(allQueryResult);

  return {
    updatedNodesSince,
    allNodesInGraph,
  };
}

async function callDeleteStaleNodesRPC(
  spaceName: string,
  nodeUids: string[],
): Promise<void> {
  try {
    console.log(
      `callDeleteStaleNodesRPC: Calling deletion RPC for space ${spaceName} with ${nodeUids.length} node UIDs`,
    );

    const response = await fetch(
      `${API_BASE_URL}/api/supabase/rpc/alpha_delete_by_source_local_ids`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          p_space_name: spaceName,
          p_source_local_ids: nodeUids,
        }),
      },
    );

    const responseText = await response.text();

    if (!response.ok) {
      console.error(
        `callDeleteStaleNodesRPC: Failed to call deletion RPC. Status: ${response.status}. Body: ${responseText}`,
      );
      throw new Error(
        `Failed to call deletion RPC: ${response.status} ${responseText}`,
      );
    }

    let results;
    try {
      results = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        `callDeleteStaleNodesRPC: Failed to parse JSON response. Status: ${response.status}. Raw response: ${responseText}`,
      );
      throw new Error(
        `Failed to parse JSON response from deletion RPC: ${responseText}`,
      );
    }

    console.log(
      `callDeleteStaleNodesRPC: Successfully called deletion RPC. Response:`,
      results,
    );
  } catch (error) {
    console.error(
      `callDeleteStaleNodesRPC: Error during deletion RPC call:`,
      error,
    );
    throw error;
  }
}

export async function upsertDiscourseNodes(lastUpdateTime: string) {
  console.log("upsertDiscourseNodes: Starting incremental update process.");

  try {
    const lastUpdateTimeMs = lastUpdateTime
      ? new Date(lastUpdateTime).getTime()
      : 0;

    const { updatedNodesSince, allNodesInGraph } =
      await getAllDiscourseNodes(lastUpdateTimeMs);
    console.log(
      `upsertDiscourseNodes: Found ${updatedNodesSince.length} updated nodes since ${lastUpdateTime} and ${allNodesInGraph.length} total discourse nodes in graph`,
    );

    console.log("updatedNodesSince", updatedNodesSince);
    console.log("allNodesInGraph count", allNodesInGraph.length);

    // Get user and graph info
    const graphName = window.roamAlphaAPI.graph.name;
    const userEmail = getCurrentUserEmail() || "unknown@roamresearch.com";
    const userName = getCurrentUserDisplayName() || "Roam User";

    console.log(
      `upsertDiscourseNodes: Processing for graph: ${graphName}, user: ${userName}`,
    );

    // Only proceed with upsert if there are updated nodes
    if (updatedNodesSince.length > 0) {
      // Generate Embeddings for updated nodes
      console.log(
        `upsertDiscourseNodes: Generating embeddings for ${updatedNodesSince.length} updated nodes...`,
      );
      const embeddingResults = await getEmbeddingsService(updatedNodesSince);

      if (embeddingResults.length !== updatedNodesSince.length) {
        throw new Error(
          "Mismatch between number of nodes and generated embeddings",
        );
      }
      console.log("upsertDiscourseNodes: Embeddings generated successfully.");

      // Client-side batching
      const batchSize = 200;
      for (let i = 0; i < updatedNodesSince.length; i += batchSize) {
        const batch = updatedNodesSince.slice(i, i + batchSize);
        const requestBody = {
          p_space_name: graphName,
          p_user_email: userEmail,
          p_user_name: userName,
          p_nodes: batch.map((node, indexInBatch) => {
            const embeddingVector = embeddingResults[i + indexInBatch].vector;
            return {
              text: node.string,
              uid: node.uid,
              vector: embeddingVector,
              metadata: {} as Record<string, unknown>,
              created: new Date(
                node["create/time"] || Date.now(),
              ).toISOString(),
              last_modified: new Date(
                node["edit/time"] || Date.now(),
              ).toISOString(),
            };
          }),
        };

        try {
          const response = await fetch(
            `${API_BASE_URL}/api/supabase/rpc/upsert-discourse-nodes`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(requestBody),
            },
          );

          const responseText = await response.text();

          if (!response.ok) {
            console.error(
              `upsertDiscourseNodes: Failed to upsert discourse nodes. Status: ${response.status}. Body: ${responseText}. Request body (full):`,
              JSON.stringify(requestBody, null, 2),
            );
            throw new Error(
              `Failed to upsert discourse nodes: ${response.status} ${responseText}`,
            );
          }

          let results;
          try {
            results = JSON.parse(responseText);
          } catch (parseError) {
            console.error(
              `upsertDiscourseNodes: Failed to parse JSON response from Supabase. Status: ${response.status}. Raw response: ${responseText}`,
            );
            throw new Error(
              `Failed to parse JSON response from Supabase: ${responseText}`,
            );
          }

          console.log(
            `upsertDiscourseNodes: Successfully processed batch. Response from Supabase:`,
            results,
          );
        } catch (error) {
          console.error(
            `upsertDiscourseNodes: Error during fetch operation for batch starting at index ${i}:`,
            error,
            "Request body (full):",
            JSON.stringify(requestBody, null, 2),
          );
          throw error;
        }
      }
    } else {
      console.log(
        "upsertDiscourseNodes: No updated nodes found. Skipping upsert.",
      );
    }

    // After upsert operations (or if no nodes to upsert), call deletion RPC
    console.log(
      "upsertDiscourseNodes: Calling deletion RPC to remove stale nodes...",
    );
    const allNodeUids = allNodesInGraph.map((node) => node.uid);
    await callDeleteStaleNodesRPC(graphName, allNodeUids);
    console.log("upsertDiscourseNodes: Deletion RPC completed.");

    // console.log("upsertDiscourseNodes: Process complete.");
  } catch (error: any) {
    console.error(
      "upsertDiscourseNodes: Critical error:",
      error.message,
      error.stack,
    );
    throw error;
  } finally {
    console.log("upsertDiscourseNodes: Process finished.");
  }
}

export async function getLastUpdateTimeByGraphName(
  graphName: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/supabase/rpc/get-last-update-time`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          spaceName: graphName,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Error fetching last update time for graph ${graphName}: ${response.status} ${response.statusText}`,
        errorBody,
      );
      return null; // Indicates failure to retrieve
    }

    const data = await response.json();
    console.log("data", data);

    if (Array.isArray(data) && data.length > 0 && data[0].last_update_time) {
      return data[0].last_update_time;
    }

    // Handle direct object response format (fallback)
    if (data && typeof data.last_update_time === "string") {
      return data.last_update_time;
    } else if (data && data.last_update_time === null) {
      // Explicitly null 'last_update_time' field, e.g. document exists but no date.
      return null;
    } else {
      console.warn(
        `Received unexpected data structure or no 'last_update_time' field for graph ${graphName}:`,
        data,
      );
      return null; // Document not found or 'last_update_time' field missing/invalid
    }
  } catch (error) {
    console.error(
      `Network or other error fetching last update time for graph ${graphName}:`,
      error,
    );
    return null;
  }
}
