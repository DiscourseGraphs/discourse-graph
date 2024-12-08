import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/releases/", "");

  try {
    const response = await fetch(
      `https://6b4k1ntlti17rkf1.public.blob.vercel-storage.com/releases/${path}`
    );

    if (!response.ok) {
      return new Response("File not found", { status: 404 });
    }

    // Forward the content-type header
    const contentType = response.headers.get("content-type");
    const data = await response.blob();

    return new Response(data, {
      headers: {
        "content-type": contentType ?? "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "cache-control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        pragma: "no-cache",
        expires: "0",
      },
    });
  } catch (error) {
    console.error("Error fetching file:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
