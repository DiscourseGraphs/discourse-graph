import { NextRequest } from "next/server";

const allowedOrigins = ["https://roamresearch.com", "http://localhost:3000"];

function isVercelPreviewUrl(origin: string | null): boolean {
  if (!origin) return false;
  return origin.includes(".vercel.app") || origin.includes("discourse-graph");
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (
    allowedOrigins.some((allowed) => origin.startsWith(allowed)) ||
    isVercelPreviewUrl(origin)
  );
}

export default function cors(req: NextRequest, res: Response) {
  const origin = req.headers.get("origin");

  const originIsAllowed = isAllowedOrigin(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...(originIsAllowed && origin
          ? { "Access-Control-Allow-Origin": origin }
          : {}),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, x-vercel-protection-bypass",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (originIsAllowed && origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-vercel-protection-bypass",
    );
  }

  return res;
}
