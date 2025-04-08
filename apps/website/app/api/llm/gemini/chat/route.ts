import { NextRequest } from "next/server";
import { handleLLMRequest, handleOptionsRequest } from "~/utils/llm/handler";
import { geminiConfig } from "~/utils/llm/providers";

export const preferredRegion = "auto";
export const maxDuration = 300;
export const runtime = "nodejs";

export const POST = (request: NextRequest): Promise<Response> => {
  return handleLLMRequest(request, geminiConfig);
};

export const OPTIONS = (request: NextRequest): Promise<Response> => {
  return handleOptionsRequest(request);
};
