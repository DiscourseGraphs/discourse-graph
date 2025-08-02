import { getLoggedInClient, getSupabaseContext } from "./supabaseContext";
import { Result } from "./types";
import { getNodeEnv } from "roamjs-components/util/env";

type ApiEmbeddingResponse = {
  data: Array<{
    embedding: number[];
  }>;
};

type ApiSupabaseResultItem = {
  roam_uid: string;
  text_content: string;
  similarity: number;
};

export type EmbeddingVectorType = number[];

export type CandidateNodeWithEmbedding = Result & {
  type: string;
};

export type SuggestedNode = Result & {
  type: string;
};

export type RelationDetails = {
  relationLabel: string;
  relatedNodeText: string;
  relatedNodeFormat: string;
};

export type NodeSearchResult = {
  object: { uid: string; text: string };
  score: number;
};

type HypotheticalNodeGenerator = (params: {
  node: string;
  relationType: RelationDetails;
}) => Promise<string>;

type EmbeddingFunc = (text: string) => Promise<EmbeddingVectorType>;

type SearchFunc = (params: {
  queryEmbedding: EmbeddingVectorType;
  indexData: CandidateNodeWithEmbedding[];
}) => Promise<NodeSearchResult[]>;

const API_CONFIG = {
  LLM: {
    URL: "https://discoursegraphs.com/api/llm/openai/chat",
    MODEL: "gpt-4.1",
    TIMEOUT_MS: 30_000,
    MAX_TOKENS: 104,
    TEMPERATURE: 0.9,
  },
  BASE_URL: {
    DEV: "http://localhost:3000",
    PROD: "http://localhost:54321",
    // "https://discourse-graph-git-store-in-supabase-discourse-graphs.vercel.app",
  },
  EMBEDDINGS: {
    PATH: "/api/embeddings/openai/small",
  },
  SUPABASE: {
    MATCH_EMBEDDINGS_PATH:
      "/api/supabase/rpc/match-embeddings-for-subset-nodes",
  },
} as const;

const getBaseUrl = (): string => {
  const isDevelopment = getNodeEnv() === "development";
  return isDevelopment ? API_CONFIG.BASE_URL.DEV : API_CONFIG.BASE_URL.PROD;
};

const handleApiError = async (
  response: Response,
  context: string,
): Promise<never> => {
  const errorText = await response.text();
  let errorData;
  try {
    errorData = JSON.parse(errorText);
  } catch (e) {
    errorData = { error: `Server responded with ${response.status}` };
  }
  console.error(
    `${context} failed with status ${response.status}. Error:`,
    errorData,
  );
  throw new Error(
    errorData.error ||
      `${context} failed with status ${response.status}. Response: ${errorText}`,
  );
};

const generateHypotheticalNode: HypotheticalNodeGenerator = async ({
  node,
  relationType,
}) => {
  const { relationLabel, relatedNodeText, relatedNodeFormat } = relationType;

  const userPromptContent = `Given the source discourse node \`\`\`${node}\`\`\`, 
and considering the relation \`\`\`${relationLabel}\`\`\` 
which typically connects to a node of type \`\`\`${relatedNodeText}\`\`\` 
(formatted like \`\`\`${relatedNodeFormat}\`\`\`), 
generate a hypothetical related discourse node text that would plausibly fit this relationship. 
Only return the text of the hypothetical node.`;
  const requestBody = {
    documents: [{ role: "user", content: userPromptContent }],
    passphrase: "",
    settings: {
      model: API_CONFIG.LLM.MODEL,
      maxTokens: API_CONFIG.LLM.MAX_TOKENS,
      temperature: API_CONFIG.LLM.TEMPERATURE,
    },
  };

  let response: Response | null = null;
  try {
    const signal = AbortSignal.timeout(API_CONFIG.LLM.TIMEOUT_MS);
    response = await fetch(API_CONFIG.LLM.URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      await handleApiError(response, "Hypothetical node generation");
    }

    return await response.text();
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      console.error("Hypothetical node generation timed out", error);
      return `Error: Failed to generate hypothetical node. Request timed out.`;
    }
    console.error("Hypothetical node generation failed:", error);
    return `Error: Failed to generate hypothetical node. ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
};

const createEmbedding: EmbeddingFunc = async (
  text: string,
): Promise<EmbeddingVectorType> => {
  if (!text.trim()) throw new Error("Input text for embedding is empty.");

  const apiUrl = `${getBaseUrl()}${API_CONFIG.EMBEDDINGS.PATH}`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: text }),
    });

    if (!response.ok) {
      await handleApiError(response, "Embedding creation");
    }

    const data = (await response.json()) as ApiEmbeddingResponse;
    if (!data?.data?.[0]?.embedding) {
      throw new Error("Invalid API response format from embedding service.");
    }
    return data.data[0].embedding;
  } catch (error: unknown) {
    console.error("Error creating embedding:", error);
    throw error;
  }
};

const searchEmbeddings: SearchFunc = async ({
  queryEmbedding,
  indexData,
}): Promise<NodeSearchResult[]> => {
  if (!indexData?.length) {
    return [];
  }
  const supabaseClient = await getLoggedInClient();

  const subsetRoamUids = indexData.map((node) => node.uid);

  const { data, error } = await supabaseClient.rpc(
    "match_embeddings_for_subset_nodes",
    {
      p_query_embedding: queryEmbedding,
      p_subset_roam_uids: subsetRoamUids,
    },
  );

  if (error) {
    console.error("Embedding search failed:", error);
    throw new Error("Embedding search failed");
  }
  const results = data;
  if (!Array.isArray(results)) {
    console.error("Embedding search response was not an array:", results);
    throw new Error("Invalid API response format: Expected an array.");
  }

  const mappedResults = results.map((item: ApiSupabaseResultItem) => ({
    object: { uid: item.roam_uid, text: item.text_content },
    score: item.similarity,
  }));
  return mappedResults;
};

const searchAgainstCandidates = async ({
  hypotheticalTexts,
  indexData,
}: {
  hypotheticalTexts: string[];
  indexData: CandidateNodeWithEmbedding[];
}): Promise<NodeSearchResult[][]> => {
  if (!hypotheticalTexts?.length || !indexData?.length) {
    return [];
  }

  const results = await Promise.all(
    hypotheticalTexts.map(async (hypoText) => {
      try {
        const queryEmbedding = await createEmbedding(hypoText);
        return await searchEmbeddings({
          queryEmbedding,
          indexData,
        });
      } catch (error: unknown) {
        let errorMessage = `Search failed for hypothetical text "${hypoText}".`;
        let errorStack;
        if (error instanceof Error) {
          errorMessage += ` Message: ${error.message}`;
          errorStack = error.stack;
        } else {
          errorMessage += ` Error: ${String(error)}`;
        }
        console.error(
          `Search exception:`,
          errorMessage,
          errorStack && `Stack: ${errorStack}`,
        );
        return [];
      }
    }),
  );
  return results;
};

const combineScores = (
  allSearchResults: NodeSearchResult[][],
): Map<string, number> => {
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
};

const rankNodes = ({
  maxScores,
  candidateNodes,
}: {
  maxScores: Map<string, number>;
  candidateNodes: CandidateNodeWithEmbedding[];
}): SuggestedNode[] => {
  if (!candidateNodes?.length) {
    return [];
  }

  const nodeMap = new Map<string, CandidateNodeWithEmbedding>(
    candidateNodes.map((node) => [node.uid, node]),
  );

  const combinedResults: { node: SuggestedNode; score: number }[] = [];
  maxScores.forEach((score, uid) => {
    const fullNode = nodeMap.get(uid);
    if (fullNode) {
      combinedResults.push({ node: fullNode, score });
    }
  });

  combinedResults.sort((a, b) => b.score - a.score);
  return combinedResults.map((item) => item.node);
};

export const findSimilarNodesUsingHyde = async ({
  candidateNodes,
  currentNodeText,
  relationDetails,
}: {
  candidateNodes: CandidateNodeWithEmbedding[];
  currentNodeText: string;
  relationDetails: RelationDetails[];
}): Promise<SuggestedNode[]> => {
  if (
    !candidateNodes?.length ||
    !currentNodeText?.trim() ||
    !relationDetails?.length
  ) {
    return [];
  }

  try {
    const hypotheticalTexts = (
      await Promise.all(
        relationDetails.map((relationType) =>
          generateHypotheticalNode({ node: currentNodeText, relationType }),
        ),
      )
    ).filter((text) => !text.startsWith("Error:"));

    if (!hypotheticalTexts.length) {
      console.warn("No valid hypothetical nodes were generated. Exiting.");
      return [];
    }

    const allSearchResults = await searchAgainstCandidates({
      hypotheticalTexts,
      indexData: candidateNodes,
    });

    const maxScores = combineScores(allSearchResults);
    return rankNodes({ maxScores, candidateNodes });
  } catch (error: unknown) {
    let errorMessage = "Failed to find similar nodes.";
    let errorStack;
    if (error instanceof Error) {
      errorMessage += ` Message: ${error.message}`;
      errorStack = error.stack;
    } else {
      errorMessage += ` Error: ${String(error)}`;
    }
    console.error(
      "Similar nodes search exception:",
      errorMessage,
      errorStack && `Stack: ${errorStack}`,
    );
    return [];
  }
};
