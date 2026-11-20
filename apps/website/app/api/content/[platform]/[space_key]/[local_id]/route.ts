import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  defaultOptionsHandler,
  createApiResponse,
} from "~/utils/supabase/apiUtils";
import { convert, MIMETYPES, type DocType } from "~/utils/conversion/convert";
import {
  findNode,
  loadConceptAddresses,
  nodePathFromSegments,
  type FoundNode,
} from "~/utils/conversion/nodeLookup";
import {
  escapeHtml,
  jsonForScript,
  sanitizeHtml,
} from "~/utils/conversion/sanitizeHtml";
import { asJsonLD } from "~/utils/conversion/jsonld";
import { spaceDataUrl } from "~/utils/conversion/nodeAddress";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { Json } from "@repo/database/dbTypes";

export type SegmentDataType = { params: Promise<Record<string, string>> };

// Scripts never run in the raw body, even if sanitizing misses something.
const RAW_BODY_CSP =
  "sandbox; default-src 'none'; img-src * data:; media-src *";

const nodeJsonLd = async ({
  supabase,
  request,
  found,
}: {
  supabase: DGSupabaseClient;
  request: NextRequest;
  found: FoundNode;
}): Promise<Record<string, Json> | undefined> => {
  const { concept, contents, space, nodePath } = found;
  const [schemaResponse, authorResponse] = await Promise.all([
    concept.schema_id
      ? supabase
          .from("Concept")
          .select()
          .eq("id", concept.schema_id)
          .maybeSingle()
      : Promise.resolve(undefined),
    concept.author_id
      ? supabase
          .from("PlatformAccount")
          .select()
          .eq("id", concept.author_id)
          .maybeSingle()
      : Promise.resolve(undefined),
  ]);
  const schema = schemaResponse?.data ?? undefined;
  const origin = request.nextUrl.origin;
  const addresses = await loadConceptAddresses({
    supabase,
    origin,
    concepts: schema ? [concept, schema] : [concept],
  });
  if ("failure" in addresses) return undefined;
  return asJsonLD({
    platform: space.platform,
    concept,
    addresses,
    ownSpaceUrl: spaceDataUrl({ origin, ...nodePath }),
    title: contents.find((c) => c.variant === "direct"),
    schema,
    // Anonymous readers may not see accounts; the metadata goes without them.
    author: authorResponse?.data ?? undefined,
    wrap: true,
  });
};

// Serves the node's body text alone, the resource that the JSON-LD
// `description` names, with the node's JSON-LD in the head.
// The full web view is under `/display`.
export const GET = async (
  request: NextRequest,
  segmentData: SegmentDataType,
): Promise<NextResponse> => {
  const { platform, space_key, local_id } = await segmentData.params;
  let targetFormat: DocType = (request.nextUrl.searchParams.get("format") ??
    "html") as DocType;
  if (MIMETYPES[targetFormat] === undefined) {
    targetFormat = "html";
  }
  const nodePath = nodePathFromSegments({
    platform,
    spaceKey: space_key,
    localId: local_id,
  });
  if ("failure" in nodePath)
    return createApiResponse(request, nodePath.failure);
  const supabase = await createClient();
  const found = await findNode({ supabase, nodePath });
  if ("failure" in found) return createApiResponse(request, found.failure);
  const { space, contents } = found;
  const fullContents = contents.find((c) => c.variant === "full");
  if (!fullContents) {
    return createApiResponse(
      request,
      asPostgrestFailure("Resource content not found", "404", 404),
    );
  }
  const source: DocType = space.platform === "Obsidian" ? "obsidian" : "roam";
  const text = convert(fullContents.text, source, targetFormat);
  if (targetFormat !== "html") {
    return new NextResponse(text, {
      headers: { "Content-Type": `${MIMETYPES[targetFormat]}; charset=utf-8` },
    });
  }
  const title = contents.find((c) => c.variant === "direct")?.text ?? "";
  const jsonLd = await nodeJsonLd({ supabase, request, found });
  const jsonLdScript = jsonLd
    ? `<script type="application/ld+json">${jsonForScript(jsonLd)}</script>`
    : "";
  const document = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
${jsonLdScript}
</head>
<body>
${sanitizeHtml(text)}
</body></html>
`;
  return new NextResponse(document, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": RAW_BODY_CSP,
    },
  });
};

export const OPTIONS = defaultOptionsHandler;
