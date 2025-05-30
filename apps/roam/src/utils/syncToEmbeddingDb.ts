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
const API_BASE_URL = "http://localhost:3000";

type RoamContentNode = {
  uid: string;
  string: string; // Primary text content for embedding - THIS WILL BE THE TITLE
  "edit/time"?: number;
  "create/time"?: number;
};

export async function getAllDiscourseNodes(
  since: number,
): Promise<RoamContentNode[]> {
  // We are using a forked version of findDiscouseNode that uses the title instead of the uid
  // because uid runs query for every node, and is too slow.

  const roamAlpha = (window as any).roamAlphaAPI;
  console.log("since", since);
  const query =
    "[:find (pull ?e [:block/uid :node/title :edit/time :create/time]) :in $ ?since :where [?e :node/title] [?e :edit/time ?edit-time] [(> ?edit-time ?since)]]";

  const queryResult = roamAlpha.data.fast.q(query, since) as [
    RoamEntityFromQuery,
  ][];
  console.log("Raw query result:", JSON.stringify(queryResult, null, 2));

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
}

export async function upsertDiscourseNodes(lastUpdateTime: string) {
  console.log("upsertDiscourseNodes: Starting incremental update process.");

  try {
    const lastUpdateTimeMs = lastUpdateTime
      ? new Date(lastUpdateTime).getTime()
      : 0;

    const nodes = await getAllDiscourseNodes(lastUpdateTimeMs);
    console.log(
      `upsertDiscourseNodes: Found ${nodes.length} updated nodes since ${lastUpdateTime} `,
    );

    console.log("nodes", nodes);

    if (nodes.length === 0) {
      console.log("upsertDiscourseNodes: No updated nodes found. Exiting.");
      return;
    }

    // Get user and graph info
    const graphName = window.roamAlphaAPI.graph.name;
    const userEmail = getCurrentUserEmail() || "unknown@roamresearch.com";
    const userName = getCurrentUserDisplayName() || "Roam User";

    console.log(
      `upsertDiscourseNodes: Processing ${nodes.length} nodes for graph: ${graphName}, user: ${userName}`,
    );

    // Generate Embeddings for updated nodes
    console.log(
      `upsertDiscourseNodes: Generating embeddings for ${nodes.length} updated nodes...`,
    );
    const embeddingResults = await getEmbeddingsService(nodes);

    if (embeddingResults.length !== nodes.length) {
      throw new Error(
        "Mismatch between number of nodes and generated embeddings",
      );
    }
    console.log("upsertDiscourseNodes: Embeddings generated successfully.");

    // Client-side batching
    const batchSize = 200;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      const requestBody = {
        p_space_name: graphName,
        p_user_email: userEmail,
        p_nodes: batch.map((node, indexInBatch) => {
          const embeddingVector = embeddingResults[i + indexInBatch].vector;
          return {
            text: node.string,
            uid: node.uid,
            vector: embeddingVector,
            metadata: {
              roam_uid: node.uid,
              roam_edit_time: node["edit/time"],
              roam_create_time: node["create/time"],
              node_title: node.string,
              graph_name: graphName,
              user_email: userEmail,
              user_name: userName,
            },
            created: new Date(node["create/time"] || Date.now()).toISOString(),
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
