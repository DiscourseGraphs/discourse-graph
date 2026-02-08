import { handleUnfurlRequest } from "cloudflare-workers-unfurl";
import { AutoRouter, error, IRequest } from "itty-router";
import { Environment } from "./types";

// make sure our sync durable object is made available to cloudflare
export { TldrawDurableObject } from "./TldrawDurableObject";

const ALLOWED_ORIGINS = [
  "https://roamresearch.com",
  "http://localhost:3000",
  "app://obsidian.md",
];

const isVercelPreviewUrl = (origin: string): boolean =>
  /^https:\/\/.*-discourse-graph-[a-z0-9]+\.vercel\.app$/.test(origin);

const isAllowedOrigin = (origin: string): boolean =>
  ALLOWED_ORIGINS.includes(origin) ||
  ALLOWED_ORIGINS.some((allowedOrigin) => origin.startsWith(allowedOrigin)) ||
  isVercelPreviewUrl(origin);

const setCorsHeaders = ({
  request,
  response,
}: {
  request: IRequest;
  response: Response;
}): Response => {
  const origin = request.headers.get("origin");
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-vercel-protection-bypass",
    );
  }
  return response;
};

const handlePreflight = (request: IRequest): Response => {
  const origin = request.headers.get("origin");
  if (!origin || !isAllowedOrigin(origin)) {
    return error(403, "Origin not allowed");
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-vercel-protection-bypass",
      "Access-Control-Max-Age": "86400",
    },
  });
};

const enforceAllowedOrigin = (request: IRequest): Response | void => {
  if (request.method === "OPTIONS") return;
  const origin = request.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return error(403, "Origin not allowed");
  }
};

const router = AutoRouter<IRequest, [env: Environment, ctx: ExecutionContext]>({
  before: [enforceAllowedOrigin],
  catch: (e) => {
    console.error(e);
    return error(e);
  },
})
  .options("*", handlePreflight)
  // requests to /connect are routed to the Durable Object, and handle realtime websocket syncing
  .get("/connect/:roomId", async (request, env) => {
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId);
    const room = env.TLDRAW_DURABLE_OBJECT.get(id);
    const response = await room.fetch(request.url, {
      headers: request.headers,
      body: request.body,
    });
    return setCorsHeaders({ request, response });
  })

  // bookmarks need to extract metadata from pasted URLs:
  .get("/unfurl", async (request) => {
    const response = await handleUnfurlRequest(request);
    return setCorsHeaders({ request, response });
  });

// export our router for cloudflare
export default router;
