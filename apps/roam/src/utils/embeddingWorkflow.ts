// apps/roam/src/utils/embeddingWorkflow.ts
// import { getEmbeddingsService } from "./embeddingService";
import { fetchSupabaseEntity, postBatchToSupabaseApi } from "./supabaseService";
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

interface BatchContentItemResponse {
  id: number; // Crucial for linking embeddings
  text_content: string; // This field name might be 'text' from our batch API, adjust if needed
  source_local_id?: string;
  // ... other fields returned by the batch content API
}

// Add this type definition near the top with other interfaces
interface NodeWithEmbedding extends RoamContentNode {
  vector: number[];
}

export const runFullEmbeddingProcess = async (): Promise<void> => {
  console.log("runFullEmbeddingProcess (BATCH API): Process started.");

  try {
    // --- 1. Setup DiscoursePlatform ---
    const platformPayload = {
      name: "roamresearch", // Or a more dynamic name if needed
      url: "https://roamresearch.com",
      api_url: "https://roamresearch.com/api", // Placeholder
      description: "Roam Research platform for Discourse Graphs",
    };
    console.log(
      "runFullEmbeddingProcess (BATCH API): Ensuring DiscoursePlatform exists...",
      platformPayload,
    );
    let platformId: number;
    try {
      const platformData = (await fetchSupabaseEntity(
        // MODIFIED: Using fetchSupabaseEntity
        "DiscoursePlatform",
        platformPayload,
      )) as DiscoursePlatformResponse; // Type assertion for clarity
      if (!platformData?.id) {
        console.error(
          "runFullEmbeddingProcess (BATCH API): DiscoursePlatform ID missing after creation/fetch.",
        );
        alert(
          "Critical Error: Could not establish DiscoursePlatform. ID missing.",
        );
        return;
      }
      platformId = platformData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (BATCH API): Failed to create/get DiscoursePlatform:",
        error.message,
      );
      alert(
        `Critical Error: Could not establish DiscoursePlatform. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (BATCH API): DiscoursePlatform ID:",
      platformId,
    );

    // --- 2. Setup DiscourseSpace (Roam Graph) ---
    const graphName = "DefaultRoamGraph";
    const graphUrl = `https://roamresearch.com/#/app/${graphName}`;

    console.log(
      "runFullEmbeddingProcess (BATCH API): Ensuring DiscourseSpace exists...",
    );
    const spacePayload = {
      name: graphName,
      url: graphUrl,
      discourse_platform_id: platformId,
    };
    let spaceId: number;
    try {
      const spaceData = (await fetchSupabaseEntity(
        // MODIFIED: Using fetchSupabaseEntity
        "DiscourseSpace",
        spacePayload,
      )) as DiscourseSpaceResponse; // Type assertion
      if (!spaceData?.id) {
        console.error(
          "runFullEmbeddingProcess (BATCH API): DiscourseSpace ID missing after creation/fetch.",
        );
        alert("Error: Could not establish DiscourseSpace. ID missing.");
        return;
      }
      spaceId = spaceData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (BATCH API): Failed to create/get DiscourseSpace:",
        error.message,
      );
      alert(
        `Error: Could not establish DiscourseSpace. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (BATCH API): DiscourseSpace ID:",
      spaceId,
    );

    // --- 3. Setup Roam User (Agent -> Person -> Account) ---
    const userName = "Default Roam User";
    const userEmail = "default_roam_user@example.com";

    // let agentId: number; // agentId will now be personId
    let personId: number; // This will be the Agent.id as well

    console.log(
      "runFullEmbeddingProcess (BATCH API): Ensuring Person (and associated Agent) exists...",
    );
    const personPayload = {
      // Payload for the "Person" get-or-create endpoint
      name: userName,
      email: userEmail,
    };
    try {
      const personData = (await fetchSupabaseEntity(
        "Person", // This endpoint now handles Agent creation if needed
        personPayload,
      )) as PersonResponse; // PersonResponse should return at least id, name, email

      if (!personData?.id) {
        console.error(
          "runFullEmbeddingProcess (BATCH API): Person ID missing after get/create.",
        );
        alert("Error: Could not establish Person. ID missing.");
        return;
      }
      personId = personData.id; // This ID is the Agent.id
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (BATCH API): Failed to get/create Person:",
        error.message,
      );
      alert(
        `Error: Could not establish Person. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (BATCH API): Person ID (Agent ID):",
      personId,
    );

    // The 'agentId' used below for Account creation is now 'personId'
    console.log(
      "runFullEmbeddingProcess (BATCH API): Creating Account for Roam user...",
    );
    const accountPayload = {
      person_id: personId, // Use the personId obtained from the Person get-or-create
      platform_id: platformId,
      active: true,
      write_permission: true, // As per previous setting
    };
    let authorAccountId: number;
    try {
      const accountData = (await fetchSupabaseEntity(
        "Account",
        accountPayload,
      )) as AccountResponse; // MODIFIED
      if (!accountData?.id) {
        console.error(
          "runFullEmbeddingProcess (BATCH API): Account ID missing after creation.",
        );
        alert("Error: Could not create Account for Roam user. ID missing.");
        return;
      }
      authorAccountId = accountData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (BATCH API): Failed to create Account:",
        error.message,
      );
      alert(
        `Error: Could not create Account for Roam user. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (BATCH API): Account ID (Author ID for content):",
      authorAccountId,
    );

    // --- 3.5. Create Document ---
    console.log(
      "runFullEmbeddingProcess (BATCH API): Creating Document for this import...",
    );
    const now = new Date().toISOString();
    const documentPayload = {
      space_id: spaceId,
      author_id: personId,
      created: now,
      last_modified: now,
      last_synced: now,
      // Optionally: source_local_id, url, metadata
    };
    let documentId: number;
    try {
      const documentData = await fetchSupabaseEntity(
        "Document",
        documentPayload,
      );
      if (!documentData?.id) {
        console.error(
          "runFullEmbeddingProcess: Document ID missing after creation.",
        );
        alert("Error: Could not create Document. ID missing.");
        return;
      }
      documentId = documentData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess: Failed to create Document:",
        error.message,
      );
      alert(
        `Error: Could not create Document. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log("runFullEmbeddingProcess: Document ID:", documentId);

    console.log(
      "runFullEmbeddingProcess (BATCH API): Supabase prerequisites obtained successfully.",
    );

    // --- 4. Fetch Roam Nodes ---
    console.log(
      "runFullEmbeddingProcess (BATCH API): Fetching Roam discourse nodes...",
    );
    const roamNodes = await getAllDiscourseNodes();
    const first5Nodes = roamNodes;

    // --- 5. Generate Embeddings for all nodes ---
    console.log(
      `runFullEmbeddingProcess (BATCH API): Generating embeddings for ${first5Nodes.length} node titles...`,
    );
    let generatedVectors: number[][];
    try {
      const embeddingResults = await getEmbeddingsService(first5Nodes);
      generatedVectors = embeddingResults.map((result) => result.vector);
    } catch (embeddingServiceError: any) {
      console.error(
        `runFullEmbeddingProcess (BATCH API): Embedding service failed. Error: ${embeddingServiceError.message}`,
      );
      alert("Critical Error: Failed to generate embeddings. Process halted.");
      return;
    }

    if (generatedVectors.length !== first5Nodes.length) {
      console.error(
        "runFullEmbeddingProcess (BATCH API): Mismatch between number of nodes and generated embeddings.",
      );
      alert(
        "Critical Error: Mismatch in embedding generation. Process halted.",
      );
      throw new Error(
        "Mismatch between number of valid nodes and generated embeddings.",
      );
    }
    console.log(
      "runFullEmbeddingProcess (BATCH API): Embeddings generated successfully.",
    );

    // --- 6. BATCH Upload Content to Supabase ---
    console.log(
      `runFullEmbeddingProcess (BATCH API): Preparing ${first5Nodes.length} Content records for batch upload...`,
    );
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < first5Nodes.length; i++) {
      const node = first5Nodes[i];
      const vector = generatedVectors[i];
      let contentId: number;

      try {
        // 6a. Create Content entry
        const currentTime = new Date().toISOString();
        const contentPayload = {
          author_id: personId,
          document_id: documentId,
          text: node.string,
          scale: "chunk_unit",
          space_id: spaceId,
          source_local_id: node.uid,
          metadata: {
            roam_uid: node.uid,
            roam_edit_time: node["edit/time"],
            roam_create_time: node["create/time"],
            node_title: node.string,
          },
          created: currentTime,
          last_modified: currentTime,
          last_synced: currentTime,
        };
        console.debug(
          `runFullEmbeddingProcess (BATCH API): Creating Content for UID ${node.uid}`,
          contentPayload,
        );

        const contentData = (await fetchSupabaseEntity(
          "Content",
          contentPayload,
        )) as BatchContentItemResponse; // MODIFIED
        if (!contentData?.id) {
          console.error(
            `runFullEmbeddingProcess (BATCH API): Error creating Content for node UID ${node.uid}: ID missing`,
          );
          errorCount++;
          continue;
        }
        contentId = contentData.id;
        console.debug(
          `runFullEmbeddingProcess (BATCH API): Content created for UID ${node.uid}, Content ID: ${contentId}`,
        );

        // 6b. Create ContentEmbedding entry
        const embeddingPayload = {
          target_id: contentId,
          vector: vector,
          model: "openai_text_embedding_3_small_1536", // ADDED - Please confirm this model name
          obsolete: false, // ADDED
        };
        console.debug(
          `runFullEmbeddingProcess (BATCH API): Creating Embedding for Content ID ${contentId}`,
        );
        await fetchSupabaseEntity(
          "ContentEmbedding_openai_text_embedding_3_small_1536",
          embeddingPayload,
        ); // MODIFIED table name

        console.debug(
          `runFullEmbeddingProcess (BATCH API): Embedding created for Content ID ${contentId}`,
        );
        successCount++;
      } catch (nodeProcessingError: any) {
        // This will catch errors from both fetchSupabaseEntity calls
        console.error(
          `runFullEmbeddingProcess (BATCH API): Error processing node UID ${node.uid}:`,
          nodeProcessingError.message,
          nodeProcessingError.stack,
        );
        errorCount++;
      }
    }

    console.log(
      `runFullEmbeddingProcess (BATCH API): Embedding process complete. Success: ${successCount}, Errors: ${errorCount}`,
    );
    if (errorCount > 0) {
      alert(
        `Process completed with ${errorCount} errors. Check console for details.`,
      );
    } else if (successCount > 0) {
      alert(
        `All ${successCount} Roam nodes processed and embedded successfully!`,
      );
    } else {
      // This case needs to be re-evaluated: if roamNodes was empty, this alert would show.
      // Consider if roamNodes.length === 0 and successCount === 0 and errorCount === 0
      alert("Process completed, but no nodes were successfully processed.");
    }
  } catch (error: any) {
    console.error(
      "runFullEmbeddingProcess (BATCH API): Critical error in overall process:",
      error.message,
      error.stack,
    );
    alert(
      `A critical error occurred: ${error.message}. Check console for details.`,
    );
  } finally {
    console.log("runFullEmbeddingProcess (BATCH API): Process finished.");
  }
};

// Removed the entire 'embeddingWorkflow' function and its 'EmbeddingWorkflowParams' interface
// as per the request to simplify and focus on 'runFullEmbeddingProcess'.
