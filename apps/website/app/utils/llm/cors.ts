import { NextRequest } from "next/server";

const allowedOrigins = [
  "https://roamresearch.com",
  "http://localhost:3000",
  "app://obsidian.md",
];

const isVercelPreviewUrl = (origin: string): boolean =>
  /^https:\/\/.*-discourse-graph-[a-z0-9]+\.vercel\.app$/.test(origin);

const isAllowedOrigin = (origin: string): boolean =>
  allowedOrigins.includes(origin) ||
  allowedOrigins.some((allowed) => origin.startsWith(allowed)) ||
  isVercelPreviewUrl(origin);

export default function cors(req: NextRequest, res: Response) {
  const origin = req.headers.get("origin");
  const originIsAllowed = origin && isAllowedOrigin(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...(originIsAllowed ? { "Access-Control-Allow-Origin": origin } : {}),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, x-vercel-protection-bypass",
        "Access-Control-Max-Age": "86400",
      },
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
