import { EmbeddingIndex, SearchResult } from "client-vector-search";
import { createEmbedding, createBatchEmbedding } from "~/utils/createEmbedding";

export const generateHypotheticalNode = async (
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

export interface SuggestedNode {
  text: string;
  uid: string;
  type: string;
}

export const findSimilarNodesUsingHyde = async (
  suggestedNodes: SuggestedNode[],
  currentNodeText: string,
  relationType: string,
): Promise<SuggestedNode[]> => {
  if (suggestedNodes.length === 0) {
    return [];
  }
  console.log("suggestedNodes", suggestedNodes);
  console.log("currentNodeText", currentNodeText);
  console.log("relationType", relationType);

  try {
    const suggestedNodeTexts = suggestedNodes.map((node) => node.text);
    const suggestedEmbeddings = await createBatchEmbedding(suggestedNodeTexts);

    const indexData = suggestedNodes.map((node, i) => ({
      id: node.uid,
      text: node.text,
      type: node.type,
      uid: node.uid,
      embedding: suggestedEmbeddings[i],
    }));

    const index = new EmbeddingIndex(indexData);

    const hypotheticalNodeText = await generateHypotheticalNode(
      currentNodeText,
      relationType,
    );
    if (hypotheticalNodeText.startsWith("Error:")) {
      console.error(
        "Failed to generate hypothetical node:",
        hypotheticalNodeText,
      );
      return [];
    }

    console.log(
      "Creating embedding for hypothetical node...",
      hypotheticalNodeText,
    );
    const queryEmbedding = await createEmbedding(hypotheticalNodeText);

    const results = await index.search(queryEmbedding, { topK: 10 });
    console.log("Query results:", results);

    return results.map((result) => ({
      uid: result.object.uid,
      text: result.object.text,
      type: result.object.type,
    }));
  } catch (error) {
    console.error("Error in findSimilarNodesUsingHyde:", error);
    return [];
  }
};
