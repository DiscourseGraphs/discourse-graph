export type EmbeddingVector = number[];

import { Result } from "./types";

export type CandidateNodeWithEmbedding = Result & {
  type: string;
  embedding: EmbeddingVector;
};

export type SuggestedNode = Result & {
  type: string;
};

export type RelationTriplet = [string, string, string];

export type HypotheticalNodeGenerator = (params: {
  node: string;
  relationType: RelationTriplet;
}) => Promise<string>;

export type EmbeddingFunc = (text: string) => Promise<EmbeddingVector>;

export type SearchResultItem = {
  object: SuggestedNode;
  score: number;
};
export type SearchFunc = (params: {
  queryEmbedding: EmbeddingVector;
  indexData: CandidateNodeWithEmbedding[];
  options: { topK: number };
}) => Promise<SearchResultItem[]>;

export const ANTHROPIC_API_URL =
  "https://discoursegraphs.com/api/llm/anthropic/chat";
export const ANTHROPIC_MODEL = "claude-3-sonnet-20240229";
export const ANTHROPIC_REQUEST_TIMEOUT_MS = 30_000;

export const generateHypotheticalNode: HypotheticalNodeGenerator = async ({
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

const searchAgainstCandidates = async ({
  hypotheticalTexts,
  indexData,
  embeddingFunction,
  searchFunction,
}: {
  hypotheticalTexts: string[];
  indexData: CandidateNodeWithEmbedding[];
  embeddingFunction: EmbeddingFunc;
  searchFunction: SearchFunc;
}): Promise<SearchResultItem[][]> => {
  const allSearchResults = await Promise.all(
    hypotheticalTexts.map(async (hypoText) => {
      try {
        const queryEmbedding = await embeddingFunction(hypoText);
        return await searchFunction({
          queryEmbedding,
          indexData,
          options: { topK: indexData.length },
        });
      } catch (error) {
        console.error(
          `Error searching for hypothetical node "${hypoText}":`,
          error,
        );
        return [];
      }
    }),
  );
  return allSearchResults;
};

const combineScores = (
  allSearchResults: SearchResultItem[][],
): Map<string, number> => {
  const maxScores = new Map<string, number>();
  for (const resultSet of allSearchResults) {
    for (const result of resultSet) {
      const currentMaxScore = maxScores.get(result.object.uid) ?? -Infinity;
      if (result.score > currentMaxScore) {
        maxScores.set(result.object.uid, result.score);
      }
    }
  }
  return maxScores;
};

const rankNodes = ({
  maxScores,
  candidateNodes,
}: {
  maxScores: Map<string, number>;
  candidateNodes: CandidateNodeWithEmbedding[];
}): SuggestedNode[] => {
  const nodeMap = new Map<string, CandidateNodeWithEmbedding>(
    candidateNodes.map((node) => [node.uid, node]),
  );
  const combinedResults = Array.from(maxScores.entries())
    .map(([uid, score]) => {
      const node = nodeMap.get(uid);
      return node ? { node, score } : undefined;
    })
    .filter(Boolean) as { node: CandidateNodeWithEmbedding; score: number }[];

  combinedResults.sort((a, b) => b.score - a.score);
  return combinedResults.map((item) => {
    const { embedding, ...restNodeProps } = item.node;
    return restNodeProps as SuggestedNode;
  });
};

export const findSimilarNodesUsingHyde = async ({
  candidateNodes,
  currentNodeText,
  relationTriplets,
  options,
}: {
  candidateNodes: CandidateNodeWithEmbedding[];
  currentNodeText: string;
  relationTriplets: RelationTriplet[];
  options: {
    hypotheticalNodeGenerator: HypotheticalNodeGenerator;
    embeddingFunction: EmbeddingFunc;
    searchFunction: SearchFunc;
  };
}): Promise<SuggestedNode[]> => {
  const { hypotheticalNodeGenerator, embeddingFunction, searchFunction } =
    options;

  if (candidateNodes.length === 0) {
    return [];
  }

  try {
    const indexData = candidateNodes;

    const hypotheticalNodePromises = [];
    for (const relationType of relationTriplets) {
      hypotheticalNodePromises.push(
        hypotheticalNodeGenerator({ node: currentNodeText, relationType }),
      );
    }
    const hypotheticalNodeTexts = (
      await Promise.all(hypotheticalNodePromises)
    ).filter((text) => !text.startsWith("Error:"));

    if (hypotheticalNodeTexts.length === 0) {
      console.error("Failed to generate any valid hypothetical nodes.");
      return [];
    }

    const allSearchResults = await searchAgainstCandidates({
      hypotheticalTexts: hypotheticalNodeTexts,
      indexData,
      embeddingFunction,
      searchFunction,
    });

    const maxScores = combineScores(allSearchResults);

    const rankedNodes = rankNodes({ maxScores, candidateNodes });

    return rankedNodes;
  } catch (error) {
    console.error("Error in findSimilarNodesUsingHyde:", error);
    return [];
  }
};
