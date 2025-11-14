import { NextRequest } from "next/server";

const allowedOrigins = ["https://roamresearch.com", "http://localhost:3000"];

const isVercelPreviewUrl = (origin: string): boolean =>
  /^https:\/\/.*-discourse-graph-[a-z0-9]+\.vercel\.app$/.test(origin);

const isAllowedOrigin = (origin: string): boolean =>
  allowedOrigins.some((allowed) => origin.startsWith(allowed)) ||
  isVercelPreviewUrl(origin);

export default function cors(req: NextRequest, res: Response) {
  const origin = req.headers.get("origin");
  const originIsAllowed = origin && isAllowedOrigin(origin);

  if (req.method === "OPTIONS") {
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-vercel-protection-bypass",
      "Access-Control-Max-Age": "86400",
    };

    // Always set Access-Control-Allow-Origin for OPTIONS requests if origin is present
    // Browsers require this header to be present for CORS preflight
    if (origin && originIsAllowed) {
      headers["Access-Control-Allow-Origin"] = origin;
    }

    return new Response(null, {
      status: 204,
      headers,
    });
  }

  if (originIsAllowed) {
    res.headers.set("Access-Control-Allow-Origin", origin as string);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-vercel-protection-bypass",
    );
  }

  return res;
}
