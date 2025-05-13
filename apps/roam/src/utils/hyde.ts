export type EmbeddingVector = number[];

import { Result } from "./types";

export type CandidateNodeWithEmbedding = {
  uid: string;
  text: string;
  type: string;
  embedding: EmbeddingVector;
  // Add any other specific properties from RoamJS 'Result' if they are used elsewhere
  // with CandidateNodeWithEmbedding and do not cause type conflicts.
  // For example: [key: string]: string | number | Date | undefined; (if necessary and compatible)
};

export type SuggestedNode = Result & {
  type: string;
};

export type RelationTriplet = [string, string, string];

// --- INTERNAL TYPES (no longer exported) ---
type HypotheticalNodeGenerator = (params: {
  node: string;
  relationType: RelationTriplet;
}) => Promise<string>;

type EmbeddingFunc = (text: string) => Promise<EmbeddingVector>;

type HydeInternalSearchResultItem = {
  object: { uid: string; text: string };
  score: number;
};

type SearchFunc = (params: {
  queryEmbedding: EmbeddingVector;
  indexData: CandidateNodeWithEmbedding[]; // Still uses exported CandidateNodeWithEmbedding
}) => Promise<HydeInternalSearchResultItem[]>;

// --- INTERNAL CONSTANTS (no longer exported) ---
const ANTHROPIC_API_URL = "https://discoursegraphs.com/api/llm/anthropic/chat";
const ANTHROPIC_MODEL = "claude-3-sonnet-20240229";
const ANTHROPIC_REQUEST_TIMEOUT_MS = 30_000;

// --- INTERNAL IMPLEMENTATIONS (no longer exported) ---

const generateHypotheticalNode: HypotheticalNodeGenerator = async ({
  node,
  relationType,
}) => {
  const [relationLabel, relatedNodeText, relatedNodeFormat] = relationType;

  const userPromptContent = `Given the source discourse node \\\`\\\`\\\`${node}\\\`\\\`\\\`, \nand considering the relation \\\`\\\`\\\`${relationLabel}\\\`\\\`\\\` \nwhich typically connects to a node of type \\\`\\\`\\\`${relatedNodeText}\\\`\\\`\\\` \n(formatted like \\\`\\\`\\\`${relatedNodeFormat}\\\`\\\`\\\`), \ngenerate a hypothetical related discourse node text that would plausibly fit this relationship. \nOnly return the text of the hypothetical node.`;
  const requestBody = {
    documents: [{ role: "user", content: userPromptContent }],
    passphrase: "",
    settings: {
      model: ANTHROPIC_MODEL,
      maxTokens: 104,
      temperature: 0.9,
    },
  };

  let response: Response | null = null;
  try {
    const signal = AbortSignal.timeout(ANTHROPIC_REQUEST_TIMEOUT_MS);
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Claude API request failed with status ${response.status}. Response Text: ${errorText}`,
      );
      throw new Error(
        `Claude API request failed with status ${response.status}: ${errorText.substring(0, 500)}`,
      );
    }

    const body = await response.json().catch(() => null);
    if (!body || typeof body.completion !== "string") {
      console.error("Claude API returned unexpected payload:", body);
      throw new Error("Claude API returned unexpected payload");
    }

    return body.completion.trim();
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      console.error(
        "Error during fetch for Claude API: Request timed out",
        error,
      );
      return `Error: Failed to generate hypothetical node. Request timed out.`;
    }
    console.error("Error during fetch for Claude API:", error);
    return `Error: Failed to generate hypothetical node. ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
};

const createEmbeddingForTextWithThrow: EmbeddingFunc = async (
  text: string,
): Promise<EmbeddingVector> => {
  if (!text.trim()) throw new Error("Input text for embedding is empty.");
  const isDevelopment =
    typeof window !== "undefined" && window.location.hostname === "localhost";
  const apiUrl = isDevelopment
    ? "http://localhost:3000/api/embeddings/openai/small"
    : "https://discoursegraphs.com/api/embeddings/openai/small";
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: text }),
    });
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: `Server responded with ${response.status}` }));
      throw new Error(
        errorData.error || `Embedding API Error (${response.status})`,
      );
    }
    const data = await response.json();
    if (!data?.data?.[0]?.embedding) {
      throw new Error("Invalid API response format from embedding service.");
    }
    return data.data[0].embedding;
  } catch (error) {
    console.error("Error in createEmbeddingForTextWithThrow:", error);
    throw error;
  }
};

const searchEmbeddingsInNodeSubsetViaRPC: SearchFunc = async ({
  queryEmbedding,
  indexData,
}): Promise<HydeInternalSearchResultItem[]> => {
  const supabaseClient =
    typeof window !== "undefined" &&
    (window as any).roamAlphaAPI?.customExtensionAPI?.supabase;
  if (!supabaseClient) {
    console.warn(
      "searchEmbeddingsInNodeSubsetViaRPC: Supabase client not available.",
    );
    return [];
  }
  const subsetRoamUids = indexData.map((node) => node.uid);
  if (subsetRoamUids.length === 0) return [];

  try {
    const { data, error } = await supabaseClient.rpc(
      "match_embeddings_for_subset_nodes",
      { p_query_embedding: queryEmbedding, p_subset_roam_uids: subsetRoamUids },
    );
    if (error) {
      console.error("RPC match_embeddings_for_subset_nodes error:", error);
      return [];
    }
    return (data || []).map((item: any) => ({
      object: { uid: item.roam_uid, text: item.text_content },
      score: item.similarity,
    }));
  } catch (e) {
    console.error("Exception in searchEmbeddingsInNodeSubsetViaRPC:", e);
    return [];
  }
};

// --- Internal Helper Functions (not exported) ---

async function searchAgainstCandidatesInternal({
  hypotheticalTexts,
  indexData,
}: {
  hypotheticalTexts: string[];
  indexData: CandidateNodeWithEmbedding[];
}): Promise<HydeInternalSearchResultItem[][]> {
  return Promise.all(
    hypotheticalTexts.map(async (hypoText) => {
      try {
        const queryEmbedding = await createEmbeddingForTextWithThrow(hypoText);
        return await searchEmbeddingsInNodeSubsetViaRPC({
          queryEmbedding,
          indexData,
        });
      } catch (error) {
        console.error(`Error searching for "${hypoText}":`, error);
        return [];
      }
    }),
  );
}

function combineScoresInternal(
  allSearchResults: HydeInternalSearchResultItem[][],
): Map<string, number> {
  const maxScores = new Map<string, number>();
  allSearchResults.forEach((resultSet) => {
    resultSet.forEach((result) => {
      const currentMax = maxScores.get(result.object.uid) ?? -Infinity;
      if (result.score > currentMax) {
        maxScores.set(result.object.uid, result.score);
      }
    });
  });
  return maxScores;
}

function rankNodesInternal({
  maxScores,
  candidateNodes,
}: {
  maxScores: Map<string, number>;
  candidateNodes: CandidateNodeWithEmbedding[];
}): SuggestedNode[] {
  const nodeMap = new Map<string, CandidateNodeWithEmbedding>(
    candidateNodes.map((node) => [node.uid, node]),
  );

  const combinedResults: { node: SuggestedNode; score: number }[] = [];
  maxScores.forEach((score, uid) => {
    const fullNode = nodeMap.get(uid);
    if (fullNode) {
      const suggestedNodeObject: SuggestedNode = {
        ...(fullNode as Omit<CandidateNodeWithEmbedding, "embedding">),
        uid: fullNode.uid,
        text: fullNode.text,
        type: fullNode.type,
      };
      combinedResults.push({ node: suggestedNodeObject, score });
    }
  });

  combinedResults.sort((a, b) => b.score - a.score);
  return combinedResults.map((item) => item.node);
}

// --- EXPORTED PUBLIC API ---
export const findSimilarNodesUsingHyde = async ({
  candidateNodes,
  currentNodeText,
  relationTriplets,
}: {
  candidateNodes: CandidateNodeWithEmbedding[];
  currentNodeText: string;
  relationTriplets: RelationTriplet[];
}): Promise<SuggestedNode[]> => {
  if (!candidateNodes?.length) return [];

  try {
    const hypotheticalTexts = (
      await Promise.all(
        relationTriplets.map((relationType) =>
          generateHypotheticalNode({ node: currentNodeText, relationType }),
        ),
      )
    ).filter((text) => !text.startsWith("Error:"));

    if (!hypotheticalTexts.length) {
      console.warn("HyDE: No valid hypothetical nodes generated.");
      return [];
    }

    const allSearchResults = await searchAgainstCandidatesInternal({
      hypotheticalTexts,
      indexData: candidateNodes,
    });

    const maxScores = combineScoresInternal(allSearchResults);
    const rankedNodes = rankNodesInternal({ maxScores, candidateNodes });

    return rankedNodes;
  } catch (error) {
    console.error("Error in findSimilarNodesUsingHyde:", error);
    return [];
  }
};
