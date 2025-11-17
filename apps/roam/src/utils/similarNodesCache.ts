import type { VectorMatch } from "~/utils/hyde";
import { findSimilarNodesVectorOnly } from "~/utils/hyde";
import { getSupabaseContext } from "~/utils/supabaseContext";

type CacheKey = string;

const resultsCache = new Map<CacheKey, VectorMatch[]>();
const inflightCache = new Map<CacheKey, Promise<VectorMatch[]>>();

const buildKey = async ({
  text,
  nodeType,
}: {
  text: string;
  nodeType: string;
}): Promise<CacheKey> => {
  const context = await getSupabaseContext();
  const spaceId = context?.spaceId ?? 0;
  // Keep the raw text; do not normalize to preserve embedding fidelity equality
  return `${spaceId}::${nodeType}::${text}`;
};

export const getCachedVectorMatches = async ({
  text,
  nodeType,
}: {
  text: string;
  nodeType: string;
}): Promise<VectorMatch[]> => {
  const key = await buildKey({ text, nodeType });
  const cached = resultsCache.get(key);
  if (cached) return cached;

  const inflight = inflightCache.get(key);
  if (inflight) return inflight;

  const fetchPromise = (async () => {
    const results = await findSimilarNodesVectorOnly({ text, nodeType });
    resultsCache.set(key, results);
    inflightCache.delete(key);
    return results;
  })();
  inflightCache.set(key, fetchPromise);
  return fetchPromise;
};

export const clearSimilarNodesCache = (): void => {
  resultsCache.clear();
  inflightCache.clear();
};
