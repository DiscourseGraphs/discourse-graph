import { NextRequest } from "next/server";
import { handleLLMRequest, handleOptionsRequest } from "~/utils/llm/handler";
import { geminiConfig } from "~/utils/llm/providers";

export const POST = (request: NextRequest): Promise<Response> => {
  return handleLLMRequest(request, geminiConfig);
};

export const OPTIONS = (request: NextRequest): Promise<Response> => {
  return handleOptionsRequest(request);
};
