// apps/roam/src/utils/embeddingWorkflow.ts
// import { getEmbeddingsService } from "./embeddingService";
import { fetchSupabaseEntity, postBatchToSupabaseApi } from "./supabaseService"; // Ensure postBatchToSupabaseApi is correctly typed for batch operations
import getDiscourseNodes from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";
import { getEmbeddingsService } from "./embeddingService";

// Type for results from the Roam Datalog query
interface RoamEntityFromQuery {
  ":block/uid": string;
  ":node/title"?: string;
  ":block/string"?: string;
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
  // We are using a forked version of findDiscouseNode that uses the title instead of the uid
  // because uid runs query for every node, and is too slow.

  const findDiscourseNodeWithTitle = (
    title = "",
    nodes = getDiscourseNodes(),
  ) => {
    const matchingNode = nodes.find((node) =>
      matchDiscourseNode({ ...node, title }),
    );
    return matchingNode;
  };

  const roamAlpha = (window as any).roamAlphaAPI;
  const query =
    "[:find (pull ?e [:block/uid :node/title :edit/time :create/time]) :where [?e :node/title]]";
  return (roamAlpha.data.fast.q(query) as [RoamEntityFromQuery][])
    .map(([entity]) => entity)
    .filter(
      (entity) =>
        entity[":block/uid"] &&
        findDiscourseNodeWithTitle(entity[":node/title"]) &&
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

interface DiscoursePlatformResponse {
  id: number;
  name: string;
  description?: string;
  url: string;
  api_url: string;
  api_key?: string;
  api_username?: string;
}

interface AgentResponse {
  id: number;
  type: string;
}

interface PersonResponse {
  id: number; // This is the Agent.id
  name: string;
  email: string;
  orcid?: string;
}

interface AccountResponse {
  id: number;
  person_id: number;
  platform_id: number;
  active: boolean;
  write_permission?: boolean;
}

interface DiscourseSpaceResponse {
  id: number;
  name: string;
  description?: string;
  platform_id: number;
  external_id?: string;
}

// This is the expected structure of items returned by the Content batch API
// It needs to include source_local_id to map back to original Roam nodes
interface BatchContentItemResponse {
  id: number;
  text_content: string; // Should match the actual field name from the API (e.g., 'text')
  source_local_id: string; // Crucial for linking embeddings
  // other fields returned by the batch content API like created, last_modified etc. might be here
}

// Payload for Content batch API
interface ContentPayload {
  author_id: number;
  document_id: number;
  text: string;
  scale: string;
  space_id: number;
  source_local_id: string;
  metadata: object;
  created: string;
  last_modified: string;
  last_synced: string;
}

// Payload for ContentEmbedding batch API
interface ContentEmbeddingPayload {
  target_id: number;
  vector: number[];
  model: string;
  obsolete: boolean;
}

// Add this type definition near the top with other interfaces
interface NodeWithEmbedding extends RoamContentNode {
  vector: number[];
}

export const runFullEmbeddingProcess = async (): Promise<void> => {
  console.log("runFullEmbeddingProcess (BATCH API V2): Process started.");

  try {
    // --- 1. Setup DiscoursePlatform ---
    const platformPayload = {
      name: "roamresearch", // Or a more dynamic name if needed
      url: "https://roamresearch.com",
      api_url: "https://roamresearch.com/api", // Placeholder
      description: "Roam Research platform for Discourse Graphs",
    };
    console.log(
      "runFullEmbeddingProcess (BATCH API V2): Ensuring DiscoursePlatform exists...",
      platformPayload,
    );
    let platformId: number;
    try {
      const platformData = (await fetchSupabaseEntity(
        "DiscoursePlatform",
        platformPayload,
      )) as DiscoursePlatformResponse;
      if (!platformData?.id) {
        console.error(
          "runFullEmbeddingProcess (BATCH API V2): DiscoursePlatform ID missing after creation/fetch.",
        );
        alert(
          "Critical Error: Could not establish DiscoursePlatform. ID missing.",
        );
        return;
      }
      platformId = platformData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (BATCH API V2): Failed to create/get DiscoursePlatform:",
        error.message,
      );
      alert(
        `Critical Error: Could not establish DiscoursePlatform. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (BATCH API V2): DiscoursePlatform ID:",
      platformId,
    );

    // --- 2. Setup DiscourseSpace (Roam Graph) ---
    const graphName = "DefaultRoamGraph"; // This could be dynamically fetched from Roam if needed
    const graphUrl = `https://roamresearch.com/#/app/${graphName}`; // Construct URL based on actual graph name

    console.log(
      "runFullEmbeddingProcess (BATCH API V2): Ensuring DiscourseSpace exists...",
    );
    const spacePayload = {
      name: graphName,
      url: graphUrl, // Pass the constructed graph URL
      discourse_platform_id: platformId,
      // external_id: could be roamAlphaAPI.graph.name or similar if available and useful
    };
    let spaceId: number;
    try {
      const spaceData = (await fetchSupabaseEntity(
        "DiscourseSpace",
        spacePayload,
      )) as DiscourseSpaceResponse;
      if (!spaceData?.id) {
        console.error(
          "runFullEmbeddingProcess (BATCH API V2): DiscourseSpace ID missing after creation/fetch.",
        );
        alert("Error: Could not establish DiscourseSpace. ID missing.");
        return;
      }
      spaceId = spaceData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (BATCH API V2): Failed to create/get DiscourseSpace:",
        error.message,
      );
      alert(
        `Error: Could not establish DiscourseSpace. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (BATCH API V2): DiscourseSpace ID:",
      spaceId,
    );

    // --- 3. Setup Roam User (Agent -> Person -> Account) ---
    const userName = "Default Roam User"; // Consider fetching actual user info if available/consented
    const userEmail = "default_roam_user@example.com"; // Placeholder, same consideration

    let personId: number;

    console.log(
      "runFullEmbeddingProcess (BATCH API V2): Ensuring Person (and associated Agent) exists...",
    );
    const personPayload = {
      name: userName,
      email: userEmail,
    };
    try {
      const personData = (await fetchSupabaseEntity(
        "Person",
        personPayload,
      )) as PersonResponse;

      if (!personData?.id) {
        console.error(
          "runFullEmbeddingProcess (BATCH API V2): Person ID missing after get/create.",
        );
        alert("Error: Could not establish Person. ID missing.");
        return;
      }
      personId = personData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (BATCH API V2): Failed to get/create Person:",
        error.message,
      );
      alert(
        `Error: Could not establish Person. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (BATCH API V2): Person ID (Agent ID):",
      personId,
    );

    console.log(
      "runFullEmbeddingProcess (BATCH API V2): Creating Account for Roam user...",
    );
    const accountPayload = {
      person_id: personId,
      platform_id: platformId,
      active: true,
      write_permission: true,
    };
    let authorAccountId: number; // This is the Account.id for the user on this platform
    try {
      const accountData = (await fetchSupabaseEntity(
        "Account",
        accountPayload,
      )) as AccountResponse;
      if (!accountData?.id) {
        console.error(
          "runFullEmbeddingProcess (BATCH API V2): Account ID missing after creation.",
        );
        alert("Error: Could not create Account for Roam user. ID missing.");
        return;
      }
      authorAccountId = accountData.id; // This is the author_id for Content if we link via Account.
      // However, current Content.author_id links to Person.id. Sticking to that.
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (BATCH API V2): Failed to create Account:",
        error.message,
      );
      alert(
        `Error: Could not create Account for Roam user. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (BATCH API V2): Account ID (Author Account for platform interaction):",
      authorAccountId,
    );

    // --- 3.5. Create Document ---
    console.log(
      "runFullEmbeddingProcess (BATCH API V2): Creating Document for this import...",
    );
    const nowForDoc = new Date().toISOString();
    const documentPayload = {
      space_id: spaceId,
      author_id: personId, // Document author is the Person
      created: nowForDoc,
      last_modified: nowForDoc,
      last_synced: nowForDoc,
      // title: `Roam Import - ${nowForDoc}`, // Optional: A title for the document
      // source_local_id: `roam-graph-${graphName}-import-${Date.now()}`, // Optional: a unique ID for this import document
      // metadata: { import_tool: "roam-extension" } // Optional
    };
    let documentId: number;
    try {
      const documentData = await fetchSupabaseEntity(
        "Document",
        documentPayload,
      );
      if (!documentData?.id) {
        console.error(
          "runFullEmbeddingProcess (BATCH API V2): Document ID missing after creation.",
        );
        alert("Error: Could not create Document. ID missing.");
        return;
      }
      documentId = documentData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (BATCH API V2): Failed to create Document:",
        error.message,
      );
      alert(
        `Error: Could not create Document. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (BATCH API V2): Document ID:",
      documentId,
    );

    console.log(
      "runFullEmbeddingProcess (BATCH API V2): Supabase prerequisites obtained successfully.",
    );

    // --- 4. Fetch Roam Nodes ---
    console.log(
      "runFullEmbeddingProcess (BATCH API V2): Fetching Roam discourse nodes...",
    );
    const roamNodes = await getAllDiscourseNodes();
    if (roamNodes.length === 0) {
      console.log(
        "runFullEmbeddingProcess (BATCH API V2): No discourse nodes found in Roam. Exiting.",
      );
      alert("No discourse nodes found in Roam to process.");
      return;
    }
    console.log(
      `runFullEmbeddingProcess (BATCH API V2): Found ${roamNodes.length} discourse nodes.`,
    );

    // --- 5. Generate Embeddings for all nodes ---
    console.log(
      `runFullEmbeddingProcess (BATCH API V2): Generating embeddings for ${roamNodes.length} node titles...`,
    );
    let generatedVectors: number[][];
    try {
      // Assuming getEmbeddingsService can handle an array of RoamContentNode and returns results in the same order
      const embeddingResults = await getEmbeddingsService(roamNodes); // Pass all nodes
      generatedVectors = embeddingResults.map((result) => result.vector);
    } catch (embeddingServiceError: any) {
      console.error(
        `runFullEmbeddingProcess (BATCH API V2): Embedding service failed. Error: ${embeddingServiceError.message}`,
      );
      alert("Critical Error: Failed to generate embeddings. Process halted.");
      return;
    }

    if (generatedVectors.length !== roamNodes.length) {
      console.error(
        "runFullEmbeddingProcess (BATCH API V2): Mismatch between number of nodes and generated embeddings.",
      );
      alert(
        "Critical Error: Mismatch in embedding generation. Process halted.",
      );
      // No throw here, allow graceful exit.
      return;
    }
    console.log(
      "runFullEmbeddingProcess (BATCH API V2): Embeddings generated successfully.",
    );

    // --- 6. BATCH Upload Content and Embeddings to Supabase ---
    console.log(
      `runFullEmbeddingProcess (BATCH API V2): Preparing ${roamNodes.length} Content records for batch upload...`,
    );

    const currentTime = new Date().toISOString();
    const contentPayloads: ContentPayload[] = roamNodes.map((node) => ({
      author_id: personId, // Content author is the Person
      document_id: documentId,
      text: node.string, // This is the title, as per RoamContentNode
      scale: "chunk_unit", // Assuming this scale
      space_id: spaceId,
      source_local_id: node.uid, // Use Roam UID to map back
      metadata: {
        roam_uid: node.uid,
        roam_edit_time: node["edit/time"],
        roam_create_time: node["create/time"],
        node_title: node.string, // Redundant with 'text' but can be useful in metadata
      },
      created: currentTime,
      last_modified: currentTime,
      last_synced: currentTime,
    }));

    let createdContents: BatchContentItemResponse[] = [];
    try {
      console.log(
        `runFullEmbeddingProcess (BATCH API V2): Batch inserting ${contentPayloads.length} Content records...`,
      );
      // Assuming postBatchToSupabaseApi takes (tableName, arrayOfPayloads)
      // and returns an array of the created items with their IDs and source_local_id
      createdContents = (await postBatchToSupabaseApi(
        "Content/batch", // Ensure this matches your batch API endpoint name/table for Content
        contentPayloads,
      )) as BatchContentItemResponse[]; // Adjust type if your API returns something different

      if (
        !createdContents ||
        createdContents.length !== contentPayloads.length
      ) {
        console.error(
          "runFullEmbeddingProcess (BATCH API V2): Batch Content creation failed or returned mismatched results.",
          "Expected:",
          contentPayloads.length,
          "Received:",
          createdContents?.length || 0,
        );
        alert(
          "Error: Batch Content creation failed. Some items might not have been saved. Check console.",
        );
        // Decide if to proceed or halt. For now, we'll try to process what we have.
      }
      console.log(
        `runFullEmbeddingProcess (BATCH API V2): Successfully batch inserted ${createdContents.length} Content records.`,
      );
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (BATCH API V2): Error during batch Content insertion:",
        error.message,
        error.stack,
      );
      alert(
        `Error during batch Content insertion: ${error.message}. Process halted.`,
      );
      return; // Halt if batch content insertion fails critically
    }

    // Map created content IDs back to their original nodes/vectors
    // This relies on the batch API returning 'source_local_id' for each created content item.
    const contentIdMap = new Map<string, number>(); // Map: source_local_id (node.uid) -> content_id
    createdContents.forEach((item) => {
      if (item.id && item.source_local_id) {
        contentIdMap.set(item.source_local_id, item.id);
      }
    });

    console.log(
      `runFullEmbeddingProcess (BATCH API V2): Preparing ${roamNodes.length} ContentEmbedding records for batch upload...`,
    );
    const embeddingPayloads: ContentEmbeddingPayload[] = [];
    let embeddingsToCreateCount = 0;

    for (let i = 0; i < roamNodes.length; i++) {
      const node = roamNodes[i];
      const vector = generatedVectors[i];
      const contentId = contentIdMap.get(node.uid);

      if (contentId && vector) {
        embeddingPayloads.push({
          target_id: contentId,
          vector: vector,
          model: "openai_text_embedding_3_small_1536",
          obsolete: false,
        });
        embeddingsToCreateCount++;
      } else {
        console.warn(
          `runFullEmbeddingProcess (BATCH API V2): Skipping embedding for node UID ${node.uid} due to missing Content ID or vector.`,
        );
      }
    }

    if (embeddingPayloads.length > 0) {
      try {
        console.log(
          `runFullEmbeddingProcess (BATCH API V2): Batch inserting ${embeddingPayloads.length} ContentEmbedding records...`,
        );
        // Assuming postBatchToSupabaseApi takes (tableName, arrayOfPayloads)
        // For embeddings, the response might not be as critical unless you need their IDs immediately.
        await postBatchToSupabaseApi(
          "ContentEmbedding_openai_text_embedding_3_small_1536/batch", // Ensure this matches your batch API endpoint
          embeddingPayloads,
        );
        console.log(
          `runFullEmbeddingProcess (BATCH API V2): Successfully batch inserted ${embeddingPayloads.length} ContentEmbedding records.`,
        );
      } catch (error: any) {
        console.error(
          "runFullEmbeddingProcess (BATCH API V2): Error during batch ContentEmbedding insertion:",
          error.message,
          error.stack,
        );
        alert(
          `Error during batch ContentEmbedding insertion: ${error.message}. Some embeddings might not have been saved.`,
        );
        // Don't necessarily halt, as content might be saved.
      }
    } else {
      console.log(
        "runFullEmbeddingProcess (BATCH API V2): No valid embedding payloads to send.",
      );
    }

    const finalSuccessCount = embeddingPayloads.length; // Assuming success if API call doesn't throw for batch.
    // Or, if the API returns counts, use that.
    const finalErrorCount = roamNodes.length - finalSuccessCount; // Approximation

    console.log(
      `runFullEmbeddingProcess (BATCH API V2): Embedding process complete. Embeddings attempted: ${finalSuccessCount}, Potential issues/skipped: ${finalErrorCount}`,
    );
    if (finalErrorCount > 0) {
      alert(
        `Process completed. ${finalSuccessCount} embeddings were attempted. ${finalErrorCount} items encountered issues or were skipped. Check console for details.`,
      );
    } else if (finalSuccessCount > 0) {
      alert(
        `All ${finalSuccessCount} Roam nodes processed and embeddings attempted successfully via batch!`,
      );
    } else {
      alert(
        "Process completed, but no embeddings were successfully processed or attempted in batch.",
      );
    }
  } catch (error: any) {
    console.error(
      "runFullEmbeddingProcess (BATCH API V2): Critical error in overall process:",
      error.message,
      error.stack,
    );
    alert(
      `A critical error occurred: ${error.message}. Check console for details.`,
    );
  } finally {
    console.log("runFullEmbeddingProcess (BATCH API V2): Process finished.");
  }
};

// Removed the entire 'embeddingWorkflow' function and its 'EmbeddingWorkflowParams' interface
// as per the request to simplify and focus on 'runFullEmbeddingProcess'.
