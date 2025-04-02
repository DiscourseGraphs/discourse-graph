import { NextRequest } from "next/server";

// Update allowed origins to be more permissive for testing
const allowedOrigins = [
  "https://roamresearch.com",
  "http://localhost:3000",
  "https://thunder-client.io", // For Thunder Client
];

// Function to check if a URL is a Vercel preview URL
function isVercelPreviewUrl(origin: string | null): boolean {
  if (!origin) return false;
  return origin.includes(".vercel.app") || origin.includes("discourse-graph");
}

export default function cors(req: NextRequest, res: Response) {
  const origin = req.headers.get("origin");
  const requestMethod = req.method;

  // Always allow Vercel preview URLs
  const isAllowedOrigin =
    origin &&
    (allowedOrigins.some((allowed) => origin.startsWith(allowed)) ||
      isVercelPreviewUrl(origin));

  // Handle preflight request
  if (requestMethod === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*", // During development/testing, allow all origins
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400", // 24 hours
      },
    });
  }

  // For actual requests, set permissive CORS headers during testing
  res.headers.set("Access-Control-Allow-Origin", "*"); // Allow all origins during testing
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  return res;
}
