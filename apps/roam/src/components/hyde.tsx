import { EmbeddingIndex } from "client-vector-search";
import { createEmbedding } from "~/utils/createEmbedding";

export const generateHypotheticalNode = async (
  node: string,
  relationType: string,
): Promise<string> => {
  const prompt = `Given the discourse node "${node}" and the relation type "${relationType}", generate a hypothetical related discourse node. Only return the text of the hypothetical node.`;

  try {
    const response = await fetch("https://discoursegraphs.com/api/llm/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `API request failed with status ${response.status}: ${errorText}`,
      );
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (typeof data.text === "string") {
      return data.text;
    } else {
      console.error("API response did not contain a 'text' field:", data);
      return "Error: Invalid response format from LLM.";
    }
  } catch (error) {
    console.error("Error generating hypothetical node:", error);
    return `Error: Failed to generate hypothetical node. ${error instanceof Error ? error.message : String(error)}`;
  }
};

export const createIndex = async (
  queryTerm: string,
  initialStrings: string[],
  initialEmbeddings: number[][],
) => {
  const indexData = initialStrings.map((str, i) => ({
    id: String(i + 1),
    name: `Sentence ${i + 1}`,
    text: str,
    embedding: initialEmbeddings[i] as number[],
  }));

  const index = new EmbeddingIndex(indexData);

  const queryEmbedding = await createEmbedding(queryTerm);

  const results = await index.search(Array.from(queryEmbedding), {
    topK: 5,
  });

  return results;
};
