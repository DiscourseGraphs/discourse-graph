import { generateRandomSentences } from "../utils/textGeneration";
import { EmbeddingIndex } from "client-vector-search";

export async function runVectorDbDemo() {
  const overallStart = performance.now();
  let stepStart = performance.now();

  // --- Generate Random Sentences ---
  const numberOfSentences = 500;
  const wordsPerSentence = 40;
  const initialStrings = generateRandomSentences(
    numberOfSentences,
    wordsPerSentence,
  );

  // --- Import required modules dynamically ---
  const { pipeline } = await import("@huggingface/transformers");

  // --- Create text embeddings using transformers.js ---
  const embeddingPipeline = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
  );

  console.log("Generating embeddings..."); // Added start log
  stepStart = performance.now();

  // Generate embeddings for all sentences IN BATCH
  const embeddingOutputs = await embeddingPipeline(initialStrings, {
    pooling: "mean",
    normalize: true,
  });

  // Extract the actual embedding arrays from the batched tensor output
  const batchSize = initialStrings.length;
  const embeddingDim = embeddingOutputs.dims[1];
  const initialEmbeddings: number[][] = [];
  for (let i = 0; i < batchSize; ++i) {
    const start = i * embeddingDim;
    const end = start + embeddingDim;
    initialEmbeddings.push(Array.from(embeddingOutputs.data.slice(start, end)));
  }

  const initialEmbeddingsEnd = performance.now();
  console.log(
    `Embeddings generated. Total time: ${(initialEmbeddingsEnd - stepStart).toFixed(2)}ms`,
  );

  // --- Create Index Data for client-vector-search ---
  const indexData = initialStrings.map((str, i) => ({
    id: String(i + 1),
    name: `Sentence ${i + 1}`,
    text: str,
    embedding: initialEmbeddings[i] as number[],
  }));

  console.log("Creating index...");
  stepStart = performance.now();

  const index = new EmbeddingIndex(indexData);

  const indexCreationEnd = performance.now();
  console.log(
    `Index created. Time: ${(indexCreationEnd - stepStart).toFixed(2)}ms`,
  );

  // --- Generate Query Embedding ---
  const queryTerm = "way of work";
  console.log("Generating query embedding...");
  stepStart = performance.now();

  const queryEmbeddingOutput = await embeddingPipeline(queryTerm, {
    pooling: "mean",
    normalize: true,
  });
  const queryEmbedding = new Float32Array(queryEmbeddingOutput.data);

  const queryEmbeddingEnd = performance.now();
  console.log(
    `Query embedding obtained. Time: ${(queryEmbeddingEnd - stepStart).toFixed(2)}ms`,
  );

  // --- Search Index ---
  console.log("Searching index...");
  stepStart = performance.now();

  const results = await index.search(Array.from(queryEmbedding), {
    topK: 5,
  });

  const searchEnd = performance.now();
  console.log(`Index searched. Time: ${(searchEnd - stepStart).toFixed(2)}ms`);

  const overallEnd = performance.now();
  console.log(
    `Vector DB demo finished successfully. Total time: ${(overallEnd - overallStart).toFixed(2)}ms`,
  );

  return results;
}
