import { getLoggedInClient, getSupabaseContext } from "./supabaseContext";
import { Result } from "./types";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import findDiscourseNode from "./findDiscourseNode";
import { nextApiRoot } from "@repo/utils/execContext";
import { DiscourseNode } from "./getDiscourseNodes";
import getExtensionAPI from "roamjs-components/util/extensionApiContext";
import { getNodesByType } from "@repo/database/lib/queries";

type ApiEmbeddingResponse = {
  data: Array<{
    embedding: number[];
  }>;
};

/* eslint-disable @typescript-eslint/naming-convention */
type ApiSupabaseResultItem = {
  roam_uid: string;
  text_content: string;
  similarity: number;
};
/* eslint-disable @typescript-eslint/naming-convention */

export type EmbeddingVectorType = number[];

export type CandidateNodeWithEmbedding = Result & {
  type: string;
};

export type SuggestedNode = Result & {
  type: string;
};

export type VectorMatch = {
  node: SuggestedNode;
  score: number;
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

type ResultItemMin = { uid?: string };

export type ExistingResultGroup = {
  label: string;
  results: Record<string, ResultItemMin>;
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
    URL: `${nextApiRoot()}/llm/openai/chat`,
    MODEL: "gpt-5-2025-08-07",
    TIMEOUT_MS: 60_000,
    MAX_TOKENS: 104,
    TEMPERATURE: 0.9,
  },
  EMBEDDINGS_URL: `${nextApiRoot()}/embeddings/openai/small`,
} as const;

const handleApiError = async (
  response: Response,
  context: string,
): Promise<never> => {
  const errorText = await response.text();
  let errorData: unknown;
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

  try {
    const response = await fetch(API_CONFIG.EMBEDDINGS_URL, {
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
  if (!supabaseClient) return [];

  const subsetRoamUids = indexData.map((node) => node.uid);

  const { data, error } = await supabaseClient.rpc(
    "match_embeddings_for_subset_nodes",
    {
      p_query_embedding: JSON.stringify(queryEmbedding),
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

const filterAndRerankByLlm = async ({
  originalText,
  candidates,
}: {
  originalText: string;
  candidates: SuggestedNode[];
}): Promise<SuggestedNode[]> => {
  if (candidates.length === 0) {
    return [];
  }

  const candidateList = candidates
    .map((c, i) => `${i + 1}. "${c.text}"`)
    .join("\n");

  const userPromptContent = `You are helping a researcher avoid creating duplicate knowledge nodes. Analyze this carefully.

**New node being created:** "${originalText}"

**Existing nodes to evaluate:**
${candidateList}

**Your task:** Categorize each node into ONE of these categories:

1. **Duplicate** - ONLY if the node represents THE SAME specific concept/action/idea as the new node
   - Must have the same intent and scope
   - Would cause genuine redundancy if both existed
   - Example: "Track daily tasks" vs "Track daily tasks and goals" = NOT duplicates (different scope)

2. **Related** - ONLY if the node is meaningfully related and the user would benefit from seeing it
   - Shares similar domain/context but serves a different purpose
   - Would be useful for cross-referencing or seeing connections
   - Example: "Synthesize observations into story" vs "Formulate research directions from literature" = Related (both involve synthesis but different outputs/contexts)

3. **Irrelevant** - Default category, do NOT include in response
   - Only vaguely similar or shares surface-level keywords
   - No real value in showing to the user
   - When in doubt, exclude it

**Be highly selective.** Most candidates should be excluded. Only include nodes where you're confident the user would find them valuable.

Return ONLY this JSON (no other text):
{
  "duplicates": ["exact text of duplicate nodes"],
  "related": ["exact text of related nodes"]
}

Use empty arrays when appropriate.`;

  const requestBody = {
    documents: [{ role: "user", content: userPromptContent }],
    passphrase: "",
    settings: {
      model: API_CONFIG.LLM.MODEL,
      maxTokens: 3000,
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
      await handleApiError(response, "LLM reranking");
      return candidates;
    }

    const responseText = await response.text();

    // Parse the response - try new format first, fall back to old format
    let duplicatesList: string[] = [];
    let relatedList: string[] = [];

    try {
      const parsed: unknown = JSON.parse(responseText);
      if (parsed && typeof parsed === "object" && "duplicates" in parsed) {
        // New format: { duplicates: [...], related: [...] }
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.duplicates)) {
          duplicatesList = obj.duplicates.filter(
            (item): item is string => typeof item === "string",
          );
        }
        if (Array.isArray(obj.related)) {
          relatedList = obj.related.filter(
            (item): item is string => typeof item === "string",
          );
        }
      } else if (Array.isArray(parsed)) {
        // Old format: just an array (treat as duplicates)
        duplicatesList = parsed.filter(
          (item): item is string => typeof item === "string",
        );
      }
    } catch (e) {
      console.error("Failed to parse LLM response:", e);
      return candidates;
    }

    const originalCandidatesMap = new Map(candidates.map((c) => [c.text, c]));

    // Combine duplicates and related, with duplicates first
    const allRelevantText = [...duplicatesList, ...relatedList];
    const rerankedNodes = allRelevantText
      .map((text) => originalCandidatesMap.get(text))
      .filter((node): node is SuggestedNode => !!node);

    console.log("LLM Filtering Results:", {
      input: `${candidates.length} vector search candidates`,
      output: `${rerankedNodes.length} nodes (${duplicatesList.length} duplicates, ${relatedList.length} related)`,
      filtered_out: candidates.length - rerankedNodes.length,
      duplicates: duplicatesList,
      related: relatedList,
    });

    return rerankedNodes;
  } catch (error: unknown) {
    console.error("LLM reranking failed:", error);
    return candidates;
  }
};

export const filterCandidatesByLlm = async ({
  originalText,
  candidates,
}: {
  originalText: string;
  candidates: SuggestedNode[];
}): Promise<SuggestedNode[]> => {
  return filterAndRerankByLlm({ originalText, candidates });
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

export const getAllPageByUidAsync = async (): Promise<[string, string][]> => {
  const pages = (await Promise.resolve(
    window.roamAlphaAPI.data.backend.q(
      "[:find ?pageName ?pageUid :where [?e :node/title ?pageName] [?e :block/uid ?pageUid]]",
    ),
  )) as [string, string][];
  return pages;
};

export const extractPagesFromChildBlock = async (
  tag: string,
): Promise<{ uid: string; text: string }[]> => {
  const results = (await Promise.resolve(
    window.roamAlphaAPI.data.backend.q(
      `[:find ?uid ?title
      :where [?b :node/title "${normalizePageTitle(tag)}"]
        [?a :block/refs ?b]
        [?p :block/children ?a]
        [?p :block/refs ?rf]
        [?rf :block/uid ?uid]
        [?rf :node/title ?title]]]`,
    ),
  )) as Array<[string, string]>;
  return results.map(([uid, title]) => ({ uid, text: title }));
};

export const extractPagesFromParentBlock = async (
  tag: string,
): Promise<{ uid: string; text: string }[]> => {
  const results = (await Promise.resolve(
    window.roamAlphaAPI.data.backend.q(
      `[:find ?uid ?title
      :where [?b :node/title "${normalizePageTitle(tag)}"]
        [?a :block/refs ?b]
        [?p :block/parents ?a]
        [?p :block/refs ?rf]
        [?rf :block/uid ?uid]
        [?rf :node/title ?title]]]`,
    ),
  )) as Array<[string, string]>;
  return results.map(([uid, title]) => ({ uid, text: title }));
};

export const getAllReferencesOnPage = async (
  pageTitle: string,
): Promise<{ uid: string; text: string }[]> => {
  const referencedPages = (await Promise.resolve(
    window.roamAlphaAPI.data.backend.q(
      `[:find ?uid ?text
      :where
        [?page :node/title "${normalizePageTitle(pageTitle)}"]
        [?b :block/page ?page]
        [?b :block/refs ?refPage]
        [?refPage :block/uid ?uid]
        [?refPage :node/title ?text]]`,
    ),
  )) as Array<[string, string]>;
  return referencedPages.map(([uid, text]) => ({ uid, text }));
};

export type PerformHydeSearchParams = {
  useAllPagesForSuggestions: boolean;
  selectedPages: string[];
  discourseNode: false | DiscourseNode;
  blockUid: string;
  validTypes: string[];
  existingResults: ExistingResultGroup[];
  uniqueRelationTypeTriplets: RelationDetails[];
  pageTitle: string;
};

export const performHydeSearch = async ({
  useAllPagesForSuggestions,
  selectedPages,
  discourseNode,
  blockUid,
  validTypes,
  existingResults,
  uniqueRelationTypeTriplets,
  pageTitle,
}: PerformHydeSearchParams): Promise<SuggestedNode[]> => {
  if (!useAllPagesForSuggestions && selectedPages.length === 0) {
    return [];
  }

  if (!discourseNode) {
    return [];
  }

  const extensionAPI = getExtensionAPI();
  const shouldGrabFromReferencedPages =
    (extensionAPI.settings.get(
      "context-grab-from-referenced-pages",
    ) as boolean) ?? true;
  const shouldGrabParentChildContext =
    (extensionAPI.settings.get(
      "context-grab-parent-child-context",
    ) as boolean) ?? true;

  let candidateNodesForHyde: SuggestedNode[] = [];

  const existingUids = new Set<string>(
    existingResults
      .flatMap((group) => Object.values(group.results).map((item) => item.uid))
      .filter((uid): uid is string => !!uid),
  );

  if (useAllPagesForSuggestions) {
    const context = await getSupabaseContext();
    if (!context) return [];
    const supabase = await getLoggedInClient();
    const spaceId = context.spaceId;
    if (!supabase) return [];

    candidateNodesForHyde = (
      await getNodesByType({
        supabase,
        spaceId,
        fields: { content: ["source_local_id", "text"] },
        ofTypes: validTypes,
        pagination: { limit: 10000 },
      })
    )
      .map((c) => {
        const node = findDiscourseNode(c.Content?.source_local_id || "");
        return {
          uid: c.Content?.source_local_id || "",
          text: c.Content?.text || "",
          type: node ? node.type : "",
        };
      })
      .filter((n) => n.uid && n.text && n.type);
  } else {
    const referenced: { uid: string; text: string }[] = [];
    if (shouldGrabFromReferencedPages) {
      referenced.push(...(await getAllReferencesOnPage(pageTitle)));
      for (const p of selectedPages) {
        referenced.push(...(await getAllReferencesOnPage(p)));
      }
    }
    if (shouldGrabParentChildContext) {
      referenced.push(...(await extractPagesFromChildBlock(pageTitle)));
      referenced.push(...(await extractPagesFromParentBlock(pageTitle)));
      for (const p of selectedPages) {
        referenced.push(...(await extractPagesFromChildBlock(p)));
        referenced.push(...(await extractPagesFromParentBlock(p)));
      }
    }
    const uniqueReferenced = Array.from(
      new Map(referenced.map((x) => [x.uid, x])).values(),
    );
    candidateNodesForHyde = uniqueReferenced
      .map((n) => {
        const node = findDiscourseNode(n.uid);
        if (
          !node ||
          node.backedBy === "default" ||
          !validTypes.includes(node.type) ||
          existingUids.has(n.uid) ||
          n.uid === blockUid
        ) {
          return null;
        }
        return {
          uid: n.uid,
          text: n.text,
          type: node.type,
        } as SuggestedNode;
      })
      .filter((n): n is SuggestedNode => n !== null);
  }

  if (candidateNodesForHyde.length && uniqueRelationTypeTriplets.length) {
    const found = await findSimilarNodesUsingHyde({
      candidateNodes: candidateNodesForHyde,
      currentNodeText: pageTitle,
      relationDetails: uniqueRelationTypeTriplets,
    });
    return found;
  }
  return [];
};

export const findSimilarNodes = async ({
  text,
  nodeType,
}: {
  text: string;
  nodeType: string;
}): Promise<{ raw: SuggestedNode[]; filtered: SuggestedNode[] }> => {
  const emptyResult = { raw: [], filtered: [] };
  if (!text.trim() || !nodeType) {
    return emptyResult;
  }

  try {
    const context = await getSupabaseContext();
    if (!context) return emptyResult;
    const supabase = await getLoggedInClient();
    const { spaceId } = context;
    if (!supabase) return emptyResult;

    const candidateNodesForHyde = (
      await getNodesByType({
        supabase,
        spaceId,
        fields: { content: ["source_local_id", "text"] },
        ofTypes: [nodeType],
        pagination: { limit: 10000 },
      })
    )
      .map((c) => {
        const node = findDiscourseNode(c.Content?.source_local_id || "");
        return {
          uid: c.Content?.source_local_id || "",
          text: c.Content?.text || "",
          type: node ? node.type : "",
        };
      })
      .filter((n) => n.uid && n.text && n.type);

    if (candidateNodesForHyde.length === 0) {
      return emptyResult;
    }

    const queryEmbedding = await createEmbedding(text);
    const searchResults = await searchEmbeddings({
      queryEmbedding,
      indexData: candidateNodesForHyde,
    });
    console.log("searchResults", searchResults);

    const nodeMap = new Map<string, CandidateNodeWithEmbedding>(
      candidateNodesForHyde.map((node) => [node.uid, node]),
    );

    const combinedResults: { node: SuggestedNode; score: number }[] = [];
    searchResults.forEach((result) => {
      const fullNode = nodeMap.get(result.object.uid);
      if (fullNode) {
        combinedResults.push({ node: fullNode, score: result.score });
      }
    });

    combinedResults.sort((a, b) => b.score - a.score);
    const topCandidates = combinedResults.slice(0, 15).map((item) => item.node);

    if (topCandidates.length === 0) {
      return emptyResult;
    }
    console.log("topCandidates", topCandidates);

    const filteredResults = await filterAndRerankByLlm({
      originalText: text,
      candidates: topCandidates,
    });

    return { raw: topCandidates, filtered: filteredResults };
  } catch (error) {
    console.error("Error finding similar nodes:", error);
    return { raw: [], filtered: [] };
  }
};

// Vector-only search: does NOT call the LLM. Returns top vector matches.
export const findSimilarNodesVectorOnly = async ({
  text,
  nodeType,
}: {
  text: string;
  nodeType: string;
}): Promise<VectorMatch[]> => {
  if (!text.trim() || !nodeType) {
    return [];
  }

  try {
    const context = await getSupabaseContext();
    if (!context) return [];
    const supabase = await getLoggedInClient();
    const { spaceId } = context;
    if (!supabase) return [];

    const candidateNodesForHyde = (
      await getNodesByType({
        supabase,
        spaceId,
        fields: { content: ["source_local_id", "text"] },
        ofTypes: [nodeType],
        pagination: { limit: 10000 },
      })
    )
      .map((c) => {
        const node = findDiscourseNode(c.Content?.source_local_id || "");
        return {
          uid: c.Content?.source_local_id || "",
          text: c.Content?.text || "",
          type: node ? node.type : "",
        };
      })
      .filter((n) => n.uid && n.text && n.type);

    if (candidateNodesForHyde.length === 0) {
      return [];
    }

    const queryEmbedding = await createEmbedding(text);
    const searchResults = await searchEmbeddings({
      queryEmbedding,
      indexData: candidateNodesForHyde,
    });

    const nodeMap = new Map<string, CandidateNodeWithEmbedding>(
      candidateNodesForHyde.map((node) => [node.uid, node]),
    );

    const combinedResults: VectorMatch[] = [];
    searchResults.forEach((result) => {
      const fullNode = nodeMap.get(result.object.uid);
      if (fullNode) {
        combinedResults.push({ node: fullNode, score: result.score });
      }
    });

    combinedResults.sort((a, b) => b.score - a.score);
    const topMatches = combinedResults.slice(0, 15);
    return topMatches;
  } catch (error) {
    console.error("Error in vector-only similar nodes search:", error);
    return [];
  }
};
