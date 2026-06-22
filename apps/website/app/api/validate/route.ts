import { NextResponse, NextRequest } from "next/server";
import { defaultOptionsHandler } from "~/utils/supabase/apiUtils";
import { validateJsonLd } from "~/utils/conversion/validation";
import { JsonLdDocument } from "jsonld";

export type SegmentDataType = { params: Promise<Record<string, string>> };

export const OPTIONS = defaultOptionsHandler;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const data = (await request.json()) as JsonLdDocument;
  const report = await validateJsonLd(data);
  return NextResponse.json(report);
};
