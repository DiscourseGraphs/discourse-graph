import { NextRequest } from "next/server";
import {
  handleLLMStreamRequest,
  handleOptionsRequest,
} from "~/utils/llm/streamHandler";
import { openaiStreamingConfig } from "~/utils/llm/providers";

export const runtime = "nodejs";
export const preferredRegion = "auto";
export const maxDuration = 300;

export const POST = (request: NextRequest): Promise<Response> => {
  return handleLLMStreamRequest(request, openaiStreamingConfig);
};

export const OPTIONS = (request: NextRequest): Promise<Response> => {
  return handleOptionsRequest(request);
};
