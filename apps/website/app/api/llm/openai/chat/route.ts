import { NextRequest } from "next/server";
import { handleLLMRequest, handleOptionsRequest } from "~/utils/llm/handler";
import { openaiConfig } from "~/utils/llm/providers";

export const runtime = "nodejs";
export const preferredRegion = "auto";
export const maxDuration = 300;

export const POST = (request: NextRequest): Promise<Response> => {
  return handleLLMRequest(request, openaiConfig);
};

export const OPTIONS = (request: NextRequest): Promise<Response> => {
  return handleOptionsRequest(request);
};
