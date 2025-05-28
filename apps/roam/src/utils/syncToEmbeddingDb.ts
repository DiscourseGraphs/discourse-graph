import isDiscourseNode from "./isDiscourseNode";
import { getEmbeddingsService } from "./embeddingService";
import { fetchSupabaseEntity, postBatchToSupabaseApi } from "./supabaseService";
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
    "[:find (pull ?e [:block/uid :node/title :edit/time :create/time]) :where [?e :node/title]]";
  return (roamAlpha.data.fast.q(query) as [RoamEntityFromQuery][])
    .map(([entity]) => entity)
    .filter(
      (entity) =>
        entity[":block/uid"] &&
        isDiscourseNode(entity[":block/uid"]) &&
        entity[":node/title"] &&
        entity[":node/title"]!.trim() !== "" &&
        entity[":edit/time"] &&
        entity[":edit/time"] > since,
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
    // Convert Supabase timestamp string to milliseconds since epoch for Roam comparison
    const lastUpdateTimeMs = lastUpdateTime
      ? new Date(lastUpdateTime).getTime()
      : 0;

    const nodes = await getAllDiscourseNodes(lastUpdateTimeMs);
    console.log(
      `upsertDiscourseNodes: Found ${nodes.length} updated nodes since ${lastUpdateTime}`,
    );

    if (nodes.length === 0) {
      console.log("upsertDiscourseNodes: No updated nodes found. Exiting.");
      return;
    }

    // Get required IDs for content records (since platform/space exist, just get their IDs)
    const graphName = window.roamAlphaAPI.graph.name;
    const userEmail = getCurrentUserEmail() || "unknown@roamresearch.com";
    const userName = getCurrentUserDisplayName() || "Roam User";

    console.log(
      "upsertDiscourseNodes: Getting required IDs for content records...",
    );

    // Try to get/create the required entities
    // If this fails, it means the setup is not complete and we should run the full process instead
    const platformPayload = {
      name: "roamresearch",
      url: "https://roamresearch.com",
    };
    const platformData = await fetchSupabaseEntity("Platform", platformPayload);
    const platformId = platformData.id;

    const graphUrl = `https://roamresearch.com/#/app/${graphName}`;
    const spacePayload = {
      name: graphName,
      url: graphUrl,
      platform: platformId,
    };
    const spaceData = await fetchSupabaseEntity("Space", spacePayload);
    const spaceId = spaceData.id;

    const personPayload = {
      name: userName,
      email: userEmail,
      type: "Person",
    };
    const personData = await fetchSupabaseEntity("Person", personPayload);
    const authorId = personData.id;

    const currentTime = new Date().toISOString();
    const documentPayload = {
      space_id: spaceId,
      author_id: authorId,
      created: currentTime,
      last_modified: currentTime,
      metadata: { graph_name: graphName, created_for: "discourse_nodes" },
      source_local_id: `discourse_nodes_document_for_${graphName}`,
    };
    const documentData = await fetchSupabaseEntity("Document", documentPayload);
    const documentId = documentData.id;

    console.log(
      `upsertDiscourseNodes: Using space_id: ${spaceId}, author_id: ${authorId}, document_id: ${documentId}`,
    );

    // Generate Embeddings for updated nodes
    console.log(
      `upsertDiscourseNodes: Generating embeddings for ${nodes.length} updated nodes...`,
    );
    const embeddingResults = await getEmbeddingsService(nodes);
    const generatedVectors = embeddingResults.map((result) => result.vector);

    if (generatedVectors.length !== nodes.length) {
      throw new Error(
        "Mismatch between number of nodes and generated embeddings",
      );
    }
    console.log("upsertDiscourseNodes: Embeddings generated successfully.");

    // Upsert Content Records
    const BATCH_SIZE = 200;

    const contentPayloads = nodes.map((node) => ({
      text: node.string,
      scale: "chunk_unit",
      space_id: spaceId,
      author_id: authorId,
      document_id: documentId,
      source_local_id: node.uid,
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
      last_modified: new Date(node["edit/time"] || Date.now()).toISOString(),
    }));

    console.log(
      `upsertDiscourseNodes: Upserting ${contentPayloads.length} Content records...`,
    );
    let upsertedContents: any[] = [];

    // Process content in batches
    for (let i = 0; i < contentPayloads.length; i += BATCH_SIZE) {
      const chunk = contentPayloads.slice(i, i + BATCH_SIZE);
      console.log(
        `Processing Content batch chunk ${i / BATCH_SIZE + 1} with ${chunk.length} items.`,
      );

      const chunkResults = await postBatchToSupabaseApi("Content/batch", chunk);
      upsertedContents.push(...chunkResults);
    }

    if (upsertedContents.length !== contentPayloads.length) {
      console.warn("Mismatch between expected and returned content records");
    }
    console.log(
      `upsertDiscourseNodes: Successfully upserted ${upsertedContents.length} Content records.`,
    );

    // Upsert Embedding Records
    // Map content IDs back to their original nodes/vectors
    const contentIdMap = new Map<string, number>();
    upsertedContents.forEach((item) => {
      if (item.id && item.source_local_id) {
        contentIdMap.set(item.source_local_id, item.id);
      }
    });

    const embeddingPayloads: any[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const vector = generatedVectors[i];
      const contentId = contentIdMap.get(node.uid);

      if (contentId && vector) {
        embeddingPayloads.push({
          target: contentId,
          vector: vector,
          model: "openai_text_embedding_3_small_1536",
          obsolete: false,
        });
      } else {
        console.warn(
          `Skipping embedding for node UID ${node.uid} due to missing Content ID or vector.`,
        );
      }
    }

    if (embeddingPayloads.length > 0) {
      console.log(
        `upsertDiscourseNodes: Processing ${embeddingPayloads.length} ContentEmbedding records...`,
      );

      // Process embeddings in batches
      for (let i = 0; i < embeddingPayloads.length; i += BATCH_SIZE) {
        const chunk = embeddingPayloads.slice(i, i + BATCH_SIZE);
        console.log(
          `Processing ContentEmbedding batch chunk ${i / BATCH_SIZE + 1} with ${chunk.length} items.`,
        );

        try {
          await postBatchToSupabaseApi(
            "ContentEmbedding_openai_text_embedding_3_small_1536/batch",
            chunk,
          );
        } catch (error: any) {
          // If we get a conflict error, it means some embeddings already exist
          // This is expected in incremental updates, so we'll continue
          if (
            error.message.includes("duplicate key") ||
            error.message.includes("23505")
          ) {
            console.warn(
              `Some embeddings already exist in batch ${i / BATCH_SIZE + 1}, this is expected for incremental updates`,
            );
          } else {
            // Re-throw other errors
            throw error;
          }
        }
      }

      console.log(
        `upsertDiscourseNodes: Successfully processed ${embeddingPayloads.length} ContentEmbedding records.`,
      );
    } else {
      console.log(
        "upsertDiscourseNodes: No valid embedding payloads to process.",
      );
    }

    const successCount = embeddingPayloads.length;
    const errorCount = nodes.length - successCount;

    console.log(
      `upsertDiscourseNodes: Process complete. Processed: ${successCount}, Issues: ${errorCount}`,
    );

    if (errorCount > 0) {
      console.warn(`${errorCount} items encountered issues during processing.`);
    }
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
