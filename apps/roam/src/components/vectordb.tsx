import { generateRandomSentences } from "../utils/textGeneration";

const EMBEDDING_BATCH_SIZE = 400;

async function getEmbeddings(input: string | string[]): Promise<number[][]> {
  // Determine API URL based on environment
  const isDevelopment = process.env.NODE_ENV === "development";
  const apiUrl = isDevelopment
    ? "http://localhost:3000/api/embeddings/openai/large" // Local dev URL
    : "https://discoursegraphs.com/api/embeddings/openai/large"; // Production URL

  const allEmbeddings: number[][] = [];

  try {
    if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = input.slice(i, i + EMBEDDING_BATCH_SIZE);
        console.log(
          `Fetching embeddings for batch ${i / EMBEDDING_BATCH_SIZE + 1}... (size: ${batch.length}) to ${apiUrl}`, // Log the URL being used
        );

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: batch }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `API Error (${response.status}) processing batch starting at index ${i}: ${errorData.error || "Failed to fetch embeddings"}`,
          );
        }

        const data = await response.json();
        if (!data || !Array.isArray(data.data)) {
          throw new Error(
            `Invalid API response format for batch starting at index ${i}. Expected 'data' array.`,
          );
        }
        const batchEmbeddings = data.data.map((item: any) => item.embedding);
        console.log(batchEmbeddings.slice(0, 10));
        console.log(
          `Batch ${i / EMBEDDING_BATCH_SIZE + 1} embeddings fetched.`,
        );
        allEmbeddings.push(...batchEmbeddings);
      }
    } else {
      console.log(`Fetching embedding for single input to ${apiUrl}...`); // Log the URL
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: input }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `API Error (${response.status}) processing single input: ${errorData.error || "Failed to fetch embeddings"}`,
        );
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error(
          "Invalid API response format for single input. Expected 'data' array with one item.",
        );
      }
      console.log(data.data[0].embedding);
      allEmbeddings.push(data.data[0].embedding);
    }

    return allEmbeddings;
  } catch (error) {
    console.error("Error getting embeddings:", error);
    throw error;
  }
}

export async function runVectorDbDemo() {
  const overallStart = performance.now();

  // --- Generate Random Sentences ---
  const numberOfSentences = 500;
  const wordsPerSentence = 40;
  const initialStrings = generateRandomSentences(
    numberOfSentences,
    wordsPerSentence,
  );

  console.log("Generating BATCH embeddings via API...");
  let initialEmbeddings: number[][] = [];
  try {
    initialEmbeddings = await getEmbeddings(initialStrings);
    if (initialEmbeddings.length !== initialStrings.length) {
      throw new Error(
        "Mismatch between number of sentences and embeddings received.",
      );
    }
  } catch (error) {
    console.error("Failed to generate initial embeddings:", error);
    return null;
  }

  console.log("Generating SINGLE embedding via API...");

  const queryTerm = "way of work";

  let queryEmbeddingArray: number[] = [];
  try {
    const queryEmbeddingsResult = await getEmbeddings(queryTerm);
    if (!queryEmbeddingsResult || queryEmbeddingsResult.length !== 1) {
      throw new Error("Failed to get a single embedding for the query.");
    }
    queryEmbeddingArray = queryEmbeddingsResult[0];
  } catch (error) {
    console.error("Failed to generate query embedding:", error);
    return null;
  }
}
