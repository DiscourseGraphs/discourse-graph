import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AnthropicModel = {
  id: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  display_name: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  created_at: string;
  type: string;
};

type AnthropicModelsResponse = {
  data: AnthropicModel[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  has_more: boolean;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  last_id: string;
};

export type ModelInfo = {
  id: string;
  displayName: string;
};

export type ModelsResponse = {
  success: boolean;
  models?: ModelInfo[];
  error?: string;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const GET = async (): Promise<NextResponse<ModelsResponse>> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Anthropic API key not configured" },
      { status: 500 },
    );
  }

  try {
    const allModels: AnthropicModel[] = [];
    let afterId: string | undefined;

    // Paginate through all models
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const url = new URL("https://api.anthropic.com/v1/models");
      url.searchParams.set("limit", "100");
      if (afterId) {
        url.searchParams.set("after_id", afterId);
      }

      const response = await fetch(url.toString(), {
        /* eslint-disable @typescript-eslint/naming-convention */
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        /* eslint-enable @typescript-eslint/naming-convention */
      });

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: `Anthropic API error: ${response.status}` },
          { status: 502 },
        );
      }

      const data = (await response.json()) as AnthropicModelsResponse;
      allModels.push(...data.data);

      if (!data.has_more) break;
      afterId = data.last_id;
    }

    const models: ModelInfo[] = allModels.map((m) => ({
      id: m.id,
      displayName: m.display_name,
    }));

    return NextResponse.json({ success: true, models });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch models" },
      { status: 500 },
    );
  }
};
