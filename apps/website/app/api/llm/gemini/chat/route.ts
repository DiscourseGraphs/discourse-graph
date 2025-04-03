import { NextRequest } from "next/server";
import {
  handleLLMRequest,
  handleOptionsRequest,
} from "../../../../../lib/llm/handler";
import { geminiConfig } from "../../../../../lib/llm/providers";

export const runtime = "nodejs";
export const preferredRegion = "auto";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<Response> {
  return handleLLMRequest(request, geminiConfig);
}

export async function OPTIONS(request: NextRequest): Promise<Response> {
  return handleOptionsRequest(request);
}
