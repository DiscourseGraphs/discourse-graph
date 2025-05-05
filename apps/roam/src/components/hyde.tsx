export interface CandidateNodeWithEmbedding {
  text: string;
  uid: string;
  type: string;
  embedding: EmbeddingVector;
}
export interface SuggestedNode {
  text: string;
  uid: string;
  type: string;
}
export type EmbeddingVector = number[];
export type HypotheticalNodeGenerator = (
  node: string,
  relationType: string,
) => Promise<string>;
export type EmbeddingFunc = (text: string) => Promise<EmbeddingVector>;
export interface SearchResultItem {
  object: SuggestedNode;
  score: number;
}
export type SearchFunc = (
  queryEmbedding: EmbeddingVector,
  indexData: CandidateNodeWithEmbedding[],
  options: { topK: number },
) => Promise<SearchResultItem[]>;

export const generateHypotheticalNode: HypotheticalNodeGenerator = async (
  node: string,
  relationType: string,
): Promise<string> => {
  // TODO: Work on the prompt with Michael

  const userPromptContent = `Given the discourse node "${node}" and the relation type "${relationType}", generate a hypothetical related discourse node. Only return the text of the hypothetical node.`;

  const requestBody = {
    documents: [{ role: "user", content: userPromptContent }],
    passphrase: "",
    settings: {
      model: "claude-3-7-sonnet-latest",
      maxTokens: 104,
      temperature: 0.9,
    },
  };

  let response: Response | null = null;
  try {
    response = await fetch(
      "https://discoursegraphs.com/api/llm/anthropic/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Claude API request failed with status ${response.status}. Response Text: ${errorText}`,
      );
      console.error("Failed Response Object:", response);
      throw new Error(
        `Claude API request failed with status ${response.status}: ${errorText.substring(0, 500)}`,
      );
    }

    const generatedText = await response.text();

    return generatedText;
  } catch (error) {
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
      console.log("Creating embedding for hypothetical node:", hypoText);
      const queryEmbedding = await embeddingFunction(hypoText);
      const results = await searchFunction(queryEmbedding, indexData, {
        topK: indexData.length,
      });
      console.log(`Search results for "${hypoText}":`, results);
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
  console.log("Max scores per node:", maxScores);
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
  console.log("Combined & Sorted Results:", combinedResults);
  return combinedResults.map((item) => ({
    text: item.node.text,
    uid: item.node.uid,
    type: item.node.type,
  }));
}

// --- Main Orchestration Function (Production Code) ---

export const findSimilarNodesUsingHyde = async (
  candidateNodes: CandidateNodeWithEmbedding[],
  currentNodeText: string,
  relationTypes: string[],
  options: {
    numHypotheticalNodes?: number;
    hypotheticalNodeGenerator: HypotheticalNodeGenerator;
    embeddingFunction: EmbeddingFunc;
    searchFunction: SearchFunc;
  },
): Promise<SuggestedNode[]> => {
  const {
    numHypotheticalNodes = 3,
    hypotheticalNodeGenerator,
    embeddingFunction,
    searchFunction,
  } = options;

  if (candidateNodes.length === 0) {
    return [];
  }
  console.log("Candidate Nodes:", candidateNodes);
  console.log("Current Node Text:", currentNodeText);
  console.log("Relation Types:", relationTypes);
  console.log("Num Hypothetical Nodes per Type:", numHypotheticalNodes);

  try {
    const indexData = candidateNodes;

    const hypotheticalNodePromises = [];
    for (const relationType of relationTypes) {
      console.log(
        `Generating ${numHypotheticalNodes} hypotheticals for relation: ${relationType}`,
      );
      for (let i = 0; i < numHypotheticalNodes; i++) {
        hypotheticalNodePromises.push(
          hypotheticalNodeGenerator(currentNodeText, relationType),
        );
      }
    }
    const hypotheticalNodeTexts = (
      await Promise.all(hypotheticalNodePromises)
    ).filter((text) => !text.startsWith("Error:"));

    if (hypotheticalNodeTexts.length === 0) {
      console.error("Failed to generate any valid hypothetical nodes.");
      return [];
    }
    console.log(
      `Generated ${hypotheticalNodeTexts.length} total Hypothetical Nodes:`,
      hypotheticalNodeTexts,
    );

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

// --- TESTING CODE START ---
// The following code is for testing purposes only and can be removed for production.

interface MockSearchResult extends SearchResultItem {}

const mockCreateEmbedding: EmbeddingFunc = async (text) => {
  console.log(`MOCK createEmbedding used for: "${text}"`);
  return Array.from({ length: 5 }, () => Math.random());
};
const mockVectorSearch: SearchFunc = async (
  queryEmbedding,
  indexData,
  options,
) => {
  console.log(`MOCK searchFunction used.`);
  const results: MockSearchResult[] = indexData.map((item) => ({
    object: { uid: item.uid, text: item.text, type: item.type },
    score: Math.random(),
  }));
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, options.topK);
};

export const runHydeTest = async () => {
  console.log("\n--- Running HyDE Test ---");

  const sampleCandidateNodes: CandidateNodeWithEmbedding[] = [
    {
      uid: "uid-a",
      text: "Node A",
      type: "test",
      embedding: Array.from({ length: 5 }, () => Math.random()),
    },
    {
      uid: "uid-b",
      text: "Node B",
      type: "test",
      embedding: Array.from({ length: 5 }, () => Math.random()),
    },
    {
      uid: "uid-c",
      text: "Node C",
      type: "test",
      embedding: Array.from({ length: 5 }, () => Math.random()),
    },
    {
      uid: "uid-d",
      text: "Node D",
      type: "test",
      embedding: Array.from({ length: 5 }, () => Math.random()),
    },
  ];

  const sampleCurrentNodeText = "Central Topic";
  const sampleRelationTypes = ["explains", "supports", "refutes"];
  const sampleNumHypothetical = 2;

  const mockHypotheticalNodeGenerator: HypotheticalNodeGenerator = async (
    node,
    relation,
  ) => {
    console.log(
      `MOCKED generateHypotheticalNode called with: ${node}, ${relation}`,
    );
    if (relation === "explains") return `Hypothetical explanation for ${node}`;
    return `Hypothetical related node for ${node}`;
  };

  console.log(
    "Input Candidates (without embeddings):",
    sampleCandidateNodes.map((n) => n.text),
  );

  try {
    const results = await findSimilarNodesUsingHyde(
      sampleCandidateNodes,
      sampleCurrentNodeText,
      sampleRelationTypes,
      {
        numHypotheticalNodes: sampleNumHypothetical,
        hypotheticalNodeGenerator: mockHypotheticalNodeGenerator,
        embeddingFunction: mockCreateEmbedding,
        searchFunction: mockVectorSearch,
      },
    );

    console.log("\n--- HyDE Test Results ---");
    console.log("Output Ranked Nodes (order depends on random mock scores):");
    results.forEach((node, index) => {
      console.log(`${index + 1}. ${node.text} (uid: ${node.uid})`);
    });
    console.log("-------------------------");
  } catch (error) {
    console.error("HyDE Test Failed:", error);
  }
};
