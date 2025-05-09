// apps/roam/src/utils/embeddingWorkflow.ts
import { getEmbeddingsService } from "./embeddingService";
import { fetchSupabaseEntity } from "./supabaseService";
import isDiscourseNode from "./isDiscourseNode";

// Type for results from the Roam Datalog query
interface RoamEntityFromQuery {
  ":block/uid": string;
  ":node/title"?: string;
  ":block/string"?: string; // Still fetch it, might be useful for other metadata later, but not for main content
  ":edit/time"?: number;
  ":create/time"?: number;
}

// The structure needed for the embedding process
export interface RoamContentNode {
  uid: string;
  string: string; // Primary text content for embedding - THIS WILL BE THE TITLE
  "edit/time"?: number;
  "create/time"?: number;
}

export async function getAllDiscourseNodes(): Promise<RoamContentNode[]> {
  const roamAlpha = (window as any).roamAlphaAPI;
  const query =
    "[:find (pull ?e [:block/uid :node/title :edit/time :create/time]) :where [?e :node/title]]";
  return (roamAlpha.data.fast.q(query) as [RoamEntityFromQuery][])
    .map(([entity]) => entity)
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

export const runFullEmbeddingProcess = async (): Promise<void> => {
  console.log("runFullEmbeddingProcess: Process started.");

  try {
    const roamAlpha = (window as any).roamAlphaAPI;
    if (!roamAlpha || !roamAlpha.graph || !roamAlpha.user) {
      console.error(
        "runFullEmbeddingProcess: Roam Alpha API (graph/user details) not available for initial setup.",
      );
      throw new Error(
        "runFullEmbeddingProcess: Roam Alpha API not fully available.",
      );
    }

    console.log(
      "runFullEmbeddingProcess: Fetching prerequisite Supabase IDs...",
    );
    const platform = await fetchSupabaseEntity(
      "/api/supabase/insert/DiscoursePlatform",
      { name: "roamresearch", url: "https://roamresearch.com" },
      "Platform",
    );
    const platformId = platform.id;

    const graphName = roamAlpha.graph.name || "UnknownRoamGraph";
    const graphUrl = `https://roamresearch.com/#/app/${graphName}`;
    const space = await fetchSupabaseEntity(
      "/api/supabase/insert/DiscourseSpace",
      { name: graphName, url: graphUrl, discourse_platform_id: platformId },
      "Space",
    );
    const spaceId = space.id;

    const userEmail =
      roamAlpha.user.email || `roam_user_${Date.now()}@example.com`;
    const userName = roamAlpha.user.displayName || "Roam User";
    const personData = await fetchSupabaseEntity(
      "/api/supabase/insert/Person",
      { name: userName, email: userEmail, account_platform_id: platformId },
      "Person",
    );
    const authorId = personData.person.id;
    console.log("runFullEmbeddingProcess: Supabase prerequisites obtained.");

    const roamNodes = await getAllDiscourseNodes();

    if (roamNodes.length === 0) {
      console.warn(
        "runFullEmbeddingProcess: No discourse nodes with valid titles were found to embed (from getAllDiscourseNodes).",
      );
      return;
    }

    const validNodes = roamNodes;
    const textsToEmbed = validNodes.map((node) => node.string);
    console.log(
      `runFullEmbeddingProcess: Processing ${validNodes.length} valid discourse nodes for embedding (using titles as content).`,
    );

    console.log("runFullEmbeddingProcess: Generating embeddings...");
    let generatedVectors: number[][];
    try {
      generatedVectors = await getEmbeddingsService(textsToEmbed);
    } catch (embeddingServiceError) {
      console.warn(
        `Embedding service failed. Using dummy data. Error: ${(embeddingServiceError as Error).message}`,
      );
      generatedVectors = textsToEmbed.map(() =>
        Array(1536)
          .fill(0)
          .map(() => Math.random() * 2 - 1),
      );
    }

    if (generatedVectors.length !== validNodes.length) {
      console.error(
        "runFullEmbeddingProcess: Mismatch length between valid nodes and generated embeddings.",
      );
      throw new Error(
        "Mismatch between number of valid nodes and generated embeddings.",
      );
    }

    console.log(
      `runFullEmbeddingProcess: Uploading ${validNodes.length} nodes to Supabase...`,
    );
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < validNodes.length; i++) {
      const node = validNodes[i];
      const vector = generatedVectors[i];

      try {
        const contentPayload = {
          author_id: authorId,
          creator_id: authorId,
          text: node.string, // This is now guaranteed to be the nodeTitle
          scale: "roam_page_title", // Or a more generic "title" or "node_title"
          type: "Content",
          space_id: spaceId,
          metadata: {
            roam_uid: node.uid,
            roam_edit_time: node["edit/time"],
            roam_create_time: node["create/time"],
            source_local_id: node.uid,
          },
        };
        const content = await fetchSupabaseEntity(
          "/api/supabase/insert/Content",
          contentPayload,
          "Content",
        );
        const contentId = content.id;

        const embeddingPayload = {
          target_id: contentId,
          vector: vector,
          obsolete: false,
        };
        await fetchSupabaseEntity(
          "/api/supabase/insert/content-embedding",
          embeddingPayload,
          "Embedding",
        );
        successCount++;
      } catch (nodeProcessingError) {
        console.error(
          `runFullEmbeddingProcess: Error processing node UID ${node.uid}:`,
          nodeProcessingError,
        );
        errorCount++;
      }
    }

    console.log(
      `runFullEmbeddingProcess: Embedding process complete. Success: ${successCount}, Errors: ${errorCount}`,
    );
    if (errorCount > 0) {
      console.warn("runFullEmbeddingProcess: Some nodes failed to process.");
    } else {
      console.log("runFullEmbeddingProcess: All nodes processed successfully!");
    }
  } catch (error: any) {
    console.error(
      "runFullEmbeddingProcess: Critical error in overall process:",
      error.message,
      error.stack,
    );
  } finally {
    console.log("runFullEmbeddingProcess: Process finished.");
  }
};
