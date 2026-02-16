import { useState, useCallback } from "react";
import type {
  NodeType,
  ExtractionResult,
  ExtractionResponse,
} from "~/types/extraction";

type ExtractParams = {
  paperText: string;
  nodeTypes: NodeType[];
  model: string;
  researchQuestion?: string;
};

export const useExtraction = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);

  const extract = useCallback(
    async (params: ExtractParams) => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const response = await fetch("/api/ai/extract", {
          method: "POST",
          // eslint-disable-next-line @typescript-eslint/naming-convention
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = (await response.json()) as ExtractionResponse;

        if (!data.success || !data.data) {
          setError(data.error ?? "Extraction failed");
          return null;
        }

        setResult(data.data);
        return data.data;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Network error";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return { extract, loading, error, result, reset };
};
