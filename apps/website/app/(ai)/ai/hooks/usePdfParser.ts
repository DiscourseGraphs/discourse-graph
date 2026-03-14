import { useState, useCallback } from "react";

type PdfParseResult = {
  text: string;
  pageCount: number;
};

export const usePdfParser = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = useCallback(async (file: File): Promise<PdfParseResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { extractText } = await import("unpdf");
      const { text, totalPages } = await extractText(
        new Uint8Array(arrayBuffer),
        { mergePages: true },
      );
      return { text, pageCount: totalPages };
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to parse PDF";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { parse, loading, error };
};
