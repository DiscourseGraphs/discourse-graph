import { useState, useEffect } from "react";
import type { ModelsResponse, ModelInfo } from "~/api/ai/models/route";

export const useModels = () => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch("/api/ai/models");
        const data = (await response.json()) as ModelsResponse;

        if (!data.success || !data.models) {
          setError(data.error ?? "Failed to load models");
          return;
        }

        setModels(data.models);
      } catch {
        setError("Failed to fetch models");
      } finally {
        setLoading(false);
      }
    };

    void fetchModels();
  }, []);

  return { models, loading, error };
};
