import { getEmbedding, EmbeddingIndex } from "client-vector-search";

// Helper function to generate random sentences
const generateRandomSentence = (
  wordList: string[],
  wordCount: number,
): string => {
  let sentence = "";
  for (let i = 0; i < wordCount; i++) {
    const randomIndex = Math.floor(Math.random() * wordList.length);
    sentence += wordList[randomIndex] + " ";
  }
  // Capitalize first letter and add period
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1).trim() + ".";
  return sentence;
};

// Simple word list for generating sentences
const sampleWordList = [
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "I",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
  "when",
  "make",
  "can",
  "like",
  "time",
  "no",
  "just",
  "him",
  "know",
  "take",
  "person",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "think",
  "also",
  "back",
  "after",
  "use",
  "two",
  "how",
  "our",
  "work",
  "first",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "any",
  "these",
  "give",
  "day",
  "most",
  "us",
];

export async function runVectorDbDemo() {
  try {
    console.log("Starting vector DB demo with 1000 random sentences...");
    const overallStart = performance.now();
    let stepStart = performance.now();

    // --- Generate Random Sentences ---
    const numberOfSentences = 60;
    const wordsPerSentence = 40;
    console.log(`Generating ${numberOfSentences} random sentences...`);
    const initialStrings: string[] = [];
    for (let i = 0; i < numberOfSentences; i++) {
      initialStrings.push(
        generateRandomSentence(sampleWordList, wordsPerSentence),
      );
    }
    console.log(
      `Generated ${initialStrings.length} sentences.`,
      initialStrings,
    );

    // --- Get Initial Embeddings --- (This will take time!)
    console.log(
      `Getting initial embeddings for ${initialStrings.length} sentences...`,
    );

    // Use Promise.all to fetch embeddings concurrently
    // Note: Processing 1000 embeddings can be slow and memory-intensive
    const initialEmbeddings = await Promise.all(
      initialStrings.map((str) => getEmbedding(str)),
    );

    const initialEmbeddingsEnd = performance.now();
    console.log(
      `Initial embeddings obtained. Total time: ${(initialEmbeddingsEnd - stepStart).toFixed(2)}ms`,
    );
    console.log(initialEmbeddings);

    // --- Create Index ---
    // Map the strings and their corresponding embeddings to the required format
    const initialObjects = initialStrings.map((str, i) => ({
      id: i + 1, // Simple sequential ID
      name: `Sentence ${i + 1}`, // Use sentence number as name
      text: str, // Keep the sentence text
      embedding: initialEmbeddings[i],
    }));

    console.log("Creating embedding index...");
    stepStart = performance.now();
    const index = new EmbeddingIndex(initialObjects);
    const indexCreationEnd = performance.now();
    console.log(
      `Index created. Time: ${(indexCreationEnd - stepStart).toFixed(2)}ms`,
    );

    // --- Get Query Embedding ---
    const queryTerm = "way of work"; // Example query
    console.log(`Getting query embedding for '${queryTerm}'...`);
    stepStart = performance.now();
    const queryEmbedding = await getEmbedding(queryTerm);
    const queryEmbeddingEnd = performance.now();
    console.log(
      `Query embedding obtained. Time: ${(queryEmbeddingEnd - stepStart).toFixed(2)}ms`,
    );

    // --- Search Index ---
    console.log("Searching index...");
    stepStart = performance.now();
    const results = await index.search(queryEmbedding, { topK: 5 });
    const searchEnd = performance.now();
    console.log(
      `Index searched. Time: ${(searchEnd - stepStart).toFixed(2)}ms`,
    );

    const overallEnd = performance.now();
    console.log("Vector DB demo results (showing top 5):", results);
    console.log(
      `Vector DB demo finished successfully. Total time: ${(overallEnd - overallStart).toFixed(2)}ms`,
    );
    // Returning all 1000 embeddings might be too much for the console
    // return results; // Consider if you need to return this large dataset
  } catch (error) {
    console.error("Error running vector DB demo:", error);
    throw error;
  }
}
