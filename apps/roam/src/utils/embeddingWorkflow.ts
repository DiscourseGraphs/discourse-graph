// apps/roam/src/utils/embeddingWorkflow.ts
// import { getEmbeddingsService } from "./embeddingService";
// import { fetchSupabaseEntity } from "./supabaseService"; // No longer used
import { fetchSupabaseEntity } from "./supabaseService"; // Added import
import getDiscourseNodes from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";

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

// const API_BASE_URL = "http://localhost:3000/api/supabase/insert"; // Or your deployed URL // REMOVED

// interface ApiResult<T> { // REMOVED
//   data?: T;
//   error?: string;
//   details?: string;
// }

// async function callApi<T>( // REMOVED
//   endpoint: string,
//   body: any,
//   method: string = "POST",
// ): Promise<ApiResult<T>> {
//   // ... existing code ...
//   try {
//     const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
//       method: method,
//       headers: {
//         "Content-Type": "application/json",
//         // Add any other necessary headers, like Authorization if you implement it
//       },
//       body: JSON.stringify(body),
//     });

//     if (!response.ok) {
//       const errorData = await response.json().catch(() => ({
//         error: "Failed to parse error response",
//         details: response.statusText,
//       }));
//       console.error(
//         `API call to ${endpoint} failed with status ${response.status}:`,
//         errorData,
//       );
//       return {
//         error: errorData.error || `HTTP error! status: ${response.status}`,
//         details: errorData.details,
//       };
//     }
//     const data = await response.json();
//     return { data };
//   } catch (error: any) {
//     console.error(`Error calling API ${endpoint}:`, error);
//     return { error: error.message || "Network error or failed to fetch" };
//   }
// }

// Define interfaces for the expected API responses (matching the `select` in your routes)
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

interface ContentResponse {
  id: number;
  text_content: string;
  source_uri?: string;
  external_id?: string;
  space_id?: number;
  author_id?: number; // This would be an Account.id
  // ... other fields
}

export const runFullEmbeddingProcess = async (): Promise<void> => {
  console.log("runFullEmbeddingProcess (NEW API HIERARCHY): Process started.");

  try {
    // --- 1. Setup DiscoursePlatform ---
    const platformPayload = {
      name: "roamresearch", // Or a more dynamic name if needed
      url: "https://roamresearch.com",
      api_url: "https://roamresearch.com/api", // Placeholder
      description: "Roam Research platform for Discourse Graphs",
    };
    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): Ensuring DiscoursePlatform exists...",
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
          "runFullEmbeddingProcess (NEW API HIERARCHY): DiscoursePlatform ID missing after creation/fetch.",
        );
        alert(
          "Critical Error: Could not establish DiscoursePlatform. ID missing.",
        );
        return;
      }
      platformId = platformData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (NEW API HIERARCHY): Failed to create/get DiscoursePlatform:",
        error.message,
      );
      alert(
        `Critical Error: Could not establish DiscoursePlatform. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): DiscoursePlatform ID:",
      platformId,
    );

    // --- 2. Setup DiscourseSpace (Roam Graph) ---
    const graphName = "DefaultRoamGraph";
    const graphUrl = `https://roamresearch.com/#/app/${graphName}`;

    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): Ensuring DiscourseSpace exists...",
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
          "runFullEmbeddingProcess (NEW API HIERARCHY): DiscourseSpace ID missing after creation/fetch.",
        );
        alert("Error: Could not establish DiscourseSpace. ID missing.");
        return;
      }
      spaceId = spaceData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (NEW API HIERARCHY): Failed to create/get DiscourseSpace:",
        error.message,
      );
      alert(
        `Error: Could not establish DiscourseSpace. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): DiscourseSpace ID:",
      spaceId,
    );

    // --- 3. Setup Roam User (Agent -> Person -> Account) ---
    const userName = "Default Roam User";
    const userEmail = `roam_user_${platformId}_${Date.now()}@example.com`;
    const personAgentType = "Person";

    let agentId: number;
    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): Creating Agent for Roam user...",
    );
    try {
      const agentData = (await fetchSupabaseEntity("Agents", {
        // MODIFIED: Using fetchSupabaseEntity
        type: personAgentType,
      })) as AgentResponse; // Type assertion
      if (!agentData?.id) {
        console.error(
          "runFullEmbeddingProcess (NEW API HIERARCHY): Agent ID missing after creation.",
        );
        alert("Error: Could not create Agent for Roam user. ID missing.");
        return;
      }
      agentId = agentData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (NEW API HIERARCHY): Failed to create Agent:",
        error.message,
      );
      alert(
        `Error: Could not create Agent for Roam user. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): Agent ID:",
      agentId,
    );

    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): Creating Person for Roam user...",
    );
    const personPayload = {
      id: agentId,
      name: userName,
      email: userEmail,
    };
    let personId: number;
    try {
      const personData = (await fetchSupabaseEntity(
        "Person",
        personPayload,
      )) as PersonResponse; // MODIFIED
      if (!personData?.id) {
        console.error(
          "runFullEmbeddingProcess (NEW API HIERARCHY): Person ID missing after creation.",
        );
        alert("Error: Could not create Person for Roam user. ID missing.");
        return;
      }
      personId = personData.id; // personData.id should be the same as agentId
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (NEW API HIERARCHY): Failed to create Person:",
        error.message,
      );
      alert(
        `Error: Could not create Person for Roam user. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): Person ID:",
      personId,
    );

    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): Creating Account for Roam user...",
    );
    const accountPayload = {
      person_id: agentId,
      platform_id: platformId,
      active: true,
    };
    let authorAccountId: number;
    try {
      const accountData = (await fetchSupabaseEntity(
        "Account",
        accountPayload,
      )) as AccountResponse; // MODIFIED
      if (!accountData?.id) {
        console.error(
          "runFullEmbeddingProcess (NEW API HIERARCHY): Account ID missing after creation.",
        );
        alert("Error: Could not create Account for Roam user. ID missing.");
        return;
      }
      authorAccountId = accountData.id;
    } catch (error: any) {
      console.error(
        "runFullEmbeddingProcess (NEW API HIERARCHY): Failed to create Account:",
        error.message,
      );
      alert(
        `Error: Could not create Account for Roam user. ${error.message || "Unknown error"}`,
      );
      return;
    }
    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): Account ID (Author ID for content):",
      authorAccountId,
    );

    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): Supabase prerequisites obtained successfully.",
    );

    // --- 4. Fetch Roam Nodes ---
    //console.log(
    //  "runFullEmbeddingProcess (NEW API HIERARCHY): Fetching Roam discourse nodes...",
    //);
    //const roamNodes = await getAllDiscourseNodes();

    //if (roamNodes.length === 0) {
    //  console.warn(
    //    "runFullEmbeddingProcess (NEW API HIERARCHY): No discourse nodes with valid titles were found to embed.",
    //  );
    //  alert("No Roam discourse nodes found to embed.");
    //  return;
    //}
    //console.log(
    //  `runFullEmbeddingProcess (NEW API HIERARCHY): Found ${roamNodes.length} discourse nodes to process.`,
    //);

    //// --- 5. Generate Embeddings for all nodes ---
    //const textsToEmbed = roamNodes.map((node) => node.string);
    //console.log(
    //  "runFullEmbeddingProcess (NEW API HIERARCHY): Generating embeddings for all node titles...",
    //);
    //let generatedVectors: number[][];
    //try {
    //  generatedVectors = await getEmbeddingsService(textsToEmbed);
    //} catch (embeddingServiceError: any) {
    //  console.warn(
    //    `runFullEmbeddingProcess (NEW API HIERARCHY): Embedding service failed. Using dummy data. Error: ${embeddingServiceError.message}`,
    //  );
    //  // Fallback to dummy data for testing if embedding service fails
    //  generatedVectors = textsToEmbed.map(() =>
    //    Array(1536) // Assuming 1536 dimensions, adjust if different
    //      .fill(0)
    //      .map(() => Math.random() * 2 - 1),
    //  );
    //}

    //if (generatedVectors.length !== roamNodes.length) {
    //  console.error(
    //    "runFullEmbeddingProcess (NEW API HIERARCHY): Mismatch between number of nodes and generated embeddings.",
    //  );
    //  alert(
    //    "Critical Error: Mismatch in embedding generation. Process halted.",
    //  );
    //  throw new Error(
    //    "Mismatch between number of valid nodes and generated embeddings.",
    //  );
    //}
    //console.log(
    //  "runFullEmbeddingProcess (NEW API HIERARCHY): Embeddings generated successfully.",
    //);

    //// --- 6. Upload Content and Embeddings to Supabase ---
    //console.log(
    //  `runFullEmbeddingProcess (NEW API HIERARCHY): Uploading ${roamNodes.length} nodes to Supabase...`,
    //);
    //let successCount = 0;
    //let errorCount = 0;

    //for (let i = 0; i < roamNodes.length; i++) {
    //  const node = roamNodes[i];
    //  const vector = generatedVectors[i];
    //  let contentId: number;

    //  try {
    //    // 6a. Create Content entry
    //    const contentPayload = {
    //      author_id: authorAccountId,
    //      text_content: node.string,
    //      scale: "roam_page_title",
    //      space_id: spaceId,
    //      source_uri: `roam:${node.uid}`,
    //      external_id: node.uid,
    //      metadata: {
    //        roam_uid: node.uid,
    //        roam_edit_time: node["edit/time"],
    //        roam_create_time: node["create/time"],
    //      },
    //    };
    //    console.debug(
    //      `runFullEmbeddingProcess (NEW API HIERARCHY): Creating Content for UID ${node.uid}`,
    //      contentPayload,
    //    );

    //    const contentData = await fetchSupabaseEntity("Content", contentPayload) as ContentResponse; // MODIFIED
    //    if (!contentData?.id) {
    //       console.error(
    //        `runFullEmbeddingProcess (NEW API HIERARCHY): Error creating Content for node UID ${node.uid}: ID missing`,
    //      );
    //      errorCount++;
    //      continue;
    //    }
    //    contentId = contentData.id;
    //    console.debug(
    //      `runFullEmbeddingProcess (NEW API HIERARCHY): Content created for UID ${node.uid}, Content ID: ${contentId}`,
    //    );

    //    // 6b. Create ContentEmbedding entry
    //    const embeddingPayload = {
    //      target_id: contentId,
    //      vector: vector,
    //    };
    //    console.debug(
    //      `runFullEmbeddingProcess (NEW API HIERARCHY): Creating Embedding for Content ID ${contentId}`,
    //    );
    //    await fetchSupabaseEntity("ContentEmbedding", embeddingPayload); // MODIFIED

    //    console.debug(
    //      `runFullEmbeddingProcess (NEW API HIERARCHY): Embedding created for Content ID ${contentId}`,
    //    );
    //    successCount++;
    //  } catch (nodeProcessingError: any) { // This will catch errors from both fetchSupabaseEntity calls
    //    console.error(
    //      `runFullEmbeddingProcess (NEW API HIERARCHY): Error processing node UID ${node.uid}:`,
    //      nodeProcessingError.message,
    //      nodeProcessingError.stack,
    //    );
    //    errorCount++;
    //  }
    //}

    //console.log(
    //  `runFullEmbeddingProcess (NEW API HIERARCHY): Embedding process complete. Success: ${successCount}, Errors: ${errorCount}`,
    //);
    //if (errorCount > 0) {
    //  alert(
    //    `Process completed with ${errorCount} errors. Check console for details.`,
    //  );
    //} else if (successCount > 0) {
    //  alert(
    //    `All ${successCount} Roam nodes processed and embedded successfully!`,
    //  );
    //} else {
    //  // This case needs to be re-evaluated: if roamNodes was empty, this alert would show.
    //  // Consider if roamNodes.length === 0 and successCount === 0 and errorCount === 0
    //  alert("Process completed, but no nodes were successfully processed.");
    //}
  } catch (error: any) {
    console.error(
      "runFullEmbeddingProcess (NEW API HIERARCHY): Critical error in overall process:",
      error.message,
      error.stack,
    );
    alert(
      `A critical error occurred: ${error.message}. Check console for details.`,
    );
  } finally {
    console.log(
      "runFullEmbeddingProcess (NEW API HIERARCHY): Process finished.",
    );
  }
};

// Removed the entire 'embeddingWorkflow' function and its 'EmbeddingWorkflowParams' interface
// as per the request to simplify and focus on 'runFullEmbeddingProcess'.
