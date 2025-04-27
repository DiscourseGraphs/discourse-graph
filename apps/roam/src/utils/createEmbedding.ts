import type {
  FeatureExtractionPipeline,
  Tensor,
} from "@huggingface/transformers";

let embeddingPipelineInstance: FeatureExtractionPipeline | null = null;

async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (embeddingPipelineInstance) {
    return embeddingPipelineInstance;
  }

  const { pipeline } = await import("@huggingface/transformers");

  // @ts-ignore
  const instance = (await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
  )) as FeatureExtractionPipeline;

  embeddingPipelineInstance = instance;
  console.log("Embedding pipeline initialized.");
  return instance;
}

export async function createBatchEmbedding(texts: string[]) {
  const embeddingPipeline = await getEmbeddingPipeline();

  // The rest of the function remains largely the same, using the obtained pipeline
  const output: Tensor = await embeddingPipeline(texts, {
    pooling: "mean",
    normalize: true,
  });

  const batchSize = texts.length;
  const embeddingDim = output.dims[1];
  const embeddings: number[][] = [];
  const data = output.data as Float32Array;

  for (let i = 0; i < batchSize; ++i) {
    const start = i * embeddingDim;
    const end = start + embeddingDim;
    embeddings.push(Array.from(data.slice(start, end)));
  }

  return embeddings;
}

export async function createEmbedding(text: string) {
  const embeddingPipeline = await getEmbeddingPipeline();

  // The rest of the function remains largely the same, using the obtained pipeline
  const output: Tensor = await embeddingPipeline(text, {
    pooling: "mean",
    normalize: true,
  });

  const embedding = Array.from(output.data as Float32Array);

  return embedding;
}
