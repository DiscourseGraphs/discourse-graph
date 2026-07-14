import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest): NextResponse =>
  NextResponse.redirect(new URL(`/canvas/${randomUUID()}`, request.url), {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
