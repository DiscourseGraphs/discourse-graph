export type EmbeddingVector = number[];

export type CandidateNodeWithEmbedding = {
  text: string;
  uid: string;
  type: string;
  embedding: EmbeddingVector;
};
export type SuggestedNode = {
  text: string;
  uid: string;
  type: string;
};

export type RelationTriplet = [string, string, string];

export type HypotheticalNodeGenerator = (
  node: string,
  relationType: RelationTriplet,
) => Promise<string>;
export type EmbeddingFunc = (text: string) => Promise<EmbeddingVector>;

export type SearchResultItem = {
  object: SuggestedNode;
  score: number;
};
export type SearchFunc = (
  queryEmbedding: EmbeddingVector,
  indexData: CandidateNodeWithEmbedding[],
  options: { topK: number },
) => Promise<SearchResultItem[]>;

const ANTHROPIC_API_URL = "https://discoursegraphs.com/api/llm/anthropic/chat";
const ANTHROPIC_MODEL = "claude-3-7-sonnet-latest";
const ANTHROPIC_REQUEST_TIMEOUT_MS = 30000;

export const generateHypotheticalNode: HypotheticalNodeGenerator = async (
  node: string,
  relationType: RelationTriplet,
): Promise<string> => {
  const [relationLabel, relatedNodeText, relatedNodeFormat] = relationType;

  const userPromptContent = `Given the source discourse node "${node}", and considering the relation 
    "${relationLabel}" which typically connects to a node of type "${relatedNodeText}" 
    (formatted like "${relatedNodeFormat}"), generate a hypothetical related discourse
     node text that would plausibly fit this relationship. Only return the text of the hypothetical node.`;

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

    const generatedText = await response.text();

    return generatedText;
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
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

async function searchAgainstCandidates(
  hypotheticalTexts: string[],
  indexData: CandidateNodeWithEmbedding[],
  embeddingFunction: EmbeddingFunc,
  searchFunction: SearchFunc,
): Promise<SearchResultItem[][]> {
  const allSearchResults: SearchResultItem[][] = [];
  for (const hypoText of hypotheticalTexts) {
    try {
      const queryEmbedding = await embeddingFunction(hypoText);
      const results = await searchFunction(queryEmbedding, indexData, {
        topK: indexData.length,
      });
      allSearchResults.push(results);
    } catch (error) {
      console.error(
        `Error searching for hypothetical node "${hypoText}":`,
        error,
      );
    }
  }
  return allSearchResults;
}

function combineScores(
  allSearchResults: SearchResultItem[][],
): Map<string, number> {
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
}

function rankNodes(
  maxScores: Map<string, number>,
  candidateNodes: CandidateNodeWithEmbedding[],
): SuggestedNode[] {
  const nodeMap = new Map<string, CandidateNodeWithEmbedding>(
    candidateNodes.map((node) => [node.uid, node]),
  );
  const combinedResults = Array.from(maxScores.entries()).map(
    ([uid, score]) => ({
      node: nodeMap.get(uid)!,
      score: score,
    }),
  );
  combinedResults.sort((a, b) => b.score - a.score);
  return combinedResults.map((item) => ({
    text: item.node.text,
    uid: item.node.uid,
    type: item.node.type,
  }));
}

export const findSimilarNodesUsingHyde = async (
  candidateNodes: CandidateNodeWithEmbedding[],
  currentNodeText: string,
  relationTriplets: RelationTriplet[],
  options: {
    hypotheticalNodeGenerator: HypotheticalNodeGenerator;
    embeddingFunction: EmbeddingFunc;
    searchFunction: SearchFunc;
  },
): Promise<SuggestedNode[]> => {
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
        hypotheticalNodeGenerator(currentNodeText, relationType),
      );
    }
    const hypotheticalNodeTexts = (
      await Promise.all(hypotheticalNodePromises)
    ).filter((text) => !text.startsWith("Error:"));

    if (hypotheticalNodeTexts.length === 0) {
      console.error("Failed to generate any valid hypothetical nodes.");
      return [];
    }

    const allSearchResults = await searchAgainstCandidates(
      hypotheticalNodeTexts,
      indexData,
      embeddingFunction,
      searchFunction,
    );

    const maxScores = combineScores(allSearchResults);

    const rankedNodes = rankNodes(maxScores, candidateNodes);

    return rankedNodes;
  } catch (error) {
    console.error("Error in findSimilarNodesUsingHyde:", error);
    return [];
  }
};
