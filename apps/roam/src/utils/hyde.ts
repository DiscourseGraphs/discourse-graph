export type EmbeddingVector = number[];

import { Result } from "./types";
import { getNodeEnv } from "roamjs-components/util/env";

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
const ANTHROPIC_API_URL = "http://localhost:3000/api/llm/openai/chat";
const ANTHROPIC_MODEL = "gpt-4.1";
const ANTHROPIC_REQUEST_TIMEOUT_MS = 30_000;
const MATCH_EMBEDDINGS_API_URL =
  "/api/supabase/rpc/match-embeddings-for-subset-nodes"; // Relative path for client-side fetch

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

    return await response.text();
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
  const isDevelopment = getNodeEnv() === "development";
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

const searchEmbeddingsInNodeSubsetViaAPI: SearchFunc = async ({
  queryEmbedding,
  indexData,
}): Promise<HydeInternalSearchResultItem[]> => {
  console.log("[HyDE Roam] searchEmbeddingsInNodeSubsetViaAPI: Started", {
    queryEmbedding: queryEmbedding?.length,
    indexDataCount: indexData?.length,
  });
  const subsetRoamUids = indexData.map((node) => node.uid);

  if (queryEmbedding.length === 0) {
    console.log(
      "[HyDE Roam] searchEmbeddingsInNodeSubsetViaAPI: No query embedding provided. Exiting.",
    );
    return [];
  }
  // Allow searching with an embedding even if subsetRoamUids is empty, the backend will handle it.
  // if (subsetRoamUids.length === 0) {
  //   console.log("[HyDE Roam] searchEmbeddingsInNodeSubsetViaAPI: No subsetRoamUids to search against. Exiting.");
  //   return [];
  // }

  const isDevelopment = getNodeEnv() === "development";
  const baseUrl = isDevelopment
    ? "http://localhost:3000"
    : "https://discoursegraphs.com";
  const fullApiUrl = `${baseUrl}${MATCH_EMBEDDINGS_API_URL}`;
  console.log(
    `[HyDE Roam] searchEmbeddingsInNodeSubsetViaAPI: Determined API URL: ${fullApiUrl}`,
  );

  try {
    console.log(
      `[HyDE Roam] searchEmbeddingsInNodeSubsetViaAPI: Calling fetch to ${fullApiUrl} with queryEmbedding length ${queryEmbedding?.length} and ${subsetRoamUids?.length} UIDs.`,
    );
    const response = await fetch(fullApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        queryEmbedding: queryEmbedding,
        subsetRoamUids: subsetRoamUids,
      }),
    });

    console.log(
      `[HyDE Roam] searchEmbeddingsInNodeSubsetViaAPI: Fetch response status: ${response.status}, ok: ${response.ok}`,
    );

    if (!response.ok) {
      let errorData;
      const responseText = await response.text(); // Get text for better error logging
      try {
        errorData = JSON.parse(responseText); // Try to parse as JSON
      } catch (e) {
        errorData = {
          error: `API Error (${response.status}): ${responseText}`,
        };
      }
      console.error(
        `[HyDE Roam] searchEmbeddingsInNodeSubsetViaAPI: API request failed to ${fullApiUrl}. Status: ${response.status}. Error Data:`,
        errorData,
      );
      throw new Error(
        errorData.error ||
          `API request failed with status ${response.status}. Response: ${responseText}`,
      );
    }

    const results = await response.json();
    console.log(
      "[HyDE Roam] searchEmbeddingsInNodeSubsetViaAPI: Received results from API:",
      results,
    );

    if (!Array.isArray(results)) {
      console.error(
        "[HyDE Roam] searchEmbeddingsInNodeSubsetViaAPI: API response was not an array.",
        results,
      );
      throw new Error("Invalid API response format: Expected an array.");
    }

    const mappedResults = results.map((item: any) => ({
      object: { uid: item.roam_uid, text: item.text_content },
      score: item.similarity,
    }));
    console.log(
      "[HyDE Roam] searchEmbeddingsInNodeSubsetViaAPI: Mapped results:",
      mappedResults,
    );
    return mappedResults;
  } catch (e: any) {
    console.error(
      `[HyDE Roam] searchEmbeddingsInNodeSubsetViaAPI: Exception calling ${fullApiUrl}:`,
      e.message,
      e.stack,
    );
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
  console.log("[HyDE Roam] searchAgainstCandidatesInternal: Started", {
    hypotheticalTextsCount: hypotheticalTexts?.length,
    indexDataCount: indexData?.length,
  });
  const results = await Promise.all(
    hypotheticalTexts.map(async (hypoText, index) => {
      console.log(
        `[HyDE Roam] searchAgainstCandidatesInternal: Processing hypothetical text ${index + 1}: "${hypoText}"`,
      );
      try {
        const queryEmbedding = await createEmbeddingForTextWithThrow(hypoText);
        console.log(
          `[HyDE Roam] searchAgainstCandidatesInternal: Generated embedding for text ${index + 1}, length: ${queryEmbedding?.length}`,
        );
        console.log(
          "[HyDE Roam] searchAgainstCandidatesInternal: Calling searchEmbeddingsInNodeSubsetViaAPI with indexData count:",
          indexData?.length,
        );
        const searchResult = await searchEmbeddingsInNodeSubsetViaAPI({
          queryEmbedding,
          indexData,
        });
        console.log(
          `[HyDE Roam] searchAgainstCandidatesInternal: Search result for text ${index + 1}:`,
          searchResult,
        );
        return searchResult;
      } catch (error: any) {
        console.error(
          `[HyDE Roam] searchAgainstCandidatesInternal: Error searching for "${hypoText}":`,
          error.message,
          error.stack,
        );
        return [];
      }
    }),
  );
  console.log(
    "[HyDE Roam] searchAgainstCandidatesInternal: All search results:",
    results,
  );
  return results;
}

function combineScoresInternal(
  allSearchResults: HydeInternalSearchResultItem[][],
): Map<string, number> {
  console.log("[HyDE Roam] combineScoresInternal: Started", {
    allSearchResultsCount: allSearchResults?.length,
  });
  const maxScores = new Map<string, number>();
  allSearchResults.forEach((resultSet) => {
    resultSet.forEach((result) => {
      const currentMax = maxScores.get(result.object.uid) ?? -Infinity;
      if (result.score > currentMax) {
        maxScores.set(result.object.uid, result.score);
      }
    });
  });
  console.log("[HyDE Roam] combineScoresInternal: Combined scores:", maxScores);
  return maxScores;
}

function rankNodesInternal({
  maxScores,
  candidateNodes,
}: {
  maxScores: Map<string, number>;
  candidateNodes: CandidateNodeWithEmbedding[];
}): SuggestedNode[] {
  console.log("[HyDE Roam] rankNodesInternal: Started", {
    maxScoresSize: maxScores?.size,
    candidateNodesCount: candidateNodes?.length,
  });
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
  const rankedNodes = combinedResults.map((item) => item.node);
  console.log("[HyDE Roam] rankNodesInternal: Ranked nodes:", rankedNodes);
  return rankedNodes;
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
  console.log("[HyDE Roam] findSimilarNodesUsingHyde: Started", {
    candidateNodesCount: candidateNodes?.length,
    currentNodeText,
    relationTriplets,
  });
  if (!candidateNodes?.length) {
    console.log(
      "[HyDE Roam] findSimilarNodesUsingHyde: No candidate nodes. Exiting.",
    );
    return [];
  }

  try {
    const hypotheticalTexts = (
      await Promise.all(
        relationTriplets.map((relationType) =>
          generateHypotheticalNode({ node: currentNodeText, relationType }),
        ),
      )
    ).filter((text) => !text.startsWith("Error:"));
    console.log(
      "[HyDE Roam] findSimilarNodesUsingHyde: Generated hypothetical texts:",
      hypotheticalTexts,
    );

    if (!hypotheticalTexts.length) {
      console.warn(
        "[HyDE Roam] findSimilarNodesUsingHyde: No valid hypothetical nodes generated. Exiting.",
      );
      return [];
    }

    console.log(
      "[HyDE Roam] findSimilarNodesUsingHyde: Calling searchAgainstCandidatesInternal.",
    );
    const allSearchResults = await searchAgainstCandidatesInternal({
      hypotheticalTexts,
      indexData: candidateNodes,
    });
    console.log(
      "[HyDE Roam] findSimilarNodesUsingHyde: Received allSearchResults:",
      allSearchResults,
    );

    const maxScores = combineScoresInternal(allSearchResults);
    console.log(
      "[HyDE Roam] findSimilarNodesUsingHyde: Calculated maxScores:",
      maxScores,
    );

    const rankedNodes = rankNodesInternal({ maxScores, candidateNodes });
    console.log(
      "[HyDE Roam] findSimilarNodesUsingHyde: Final rankedNodes:",
      rankedNodes,
    );

    return rankedNodes;
  } catch (error: any) {
    console.error(
      "[HyDE Roam] findSimilarNodesUsingHyde: Error in main function:",
      error.message,
      error.stack,
    );
    return [];
  }
};
