import { NextResponse, type NextRequest } from "next/server";
import type { PostgrestMaybeSingleResponse } from "@supabase/supabase-js";
import { createClient } from "~/utils/supabase/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import { createApiResponse } from "~/utils/supabase/apiUtils";
import { asJsonLD, wrapJsonLd } from "~/utils/conversion/jsonld";
import type { Tables } from "@repo/database/dbTypes";
import type { ColumnRow } from "@repo/database/inputTypes";
import { MIMETYPES, type DocType } from "~/utils/conversion/convert";
import { findNode, loadConceptAddresses } from "~/utils/conversion/nodeLookup";
import {
  nodeContentUrl,
  nodeDataUrl,
  spaceDataUrl,
  type NodePath,
} from "~/utils/conversion/nodeAddress";

type Concept = ColumnRow<"Concept">;
type PlatformAccount = Tables<"PlatformAccount">;

// Serves the JSON-LD description of one node. Both the address route and the
// RID lookup use it; `Content-Location` always gives the node's address.
export const nodeDataResponse = async ({
  request,
  nodePath,
}: {
  request: NextRequest;
  nodePath: NodePath;
}): Promise<NextResponse> => {
  let targetFormat = (request.nextUrl.searchParams.get("format") ?? "html") as
    | DocType
    | "none";
  if (targetFormat !== "none" && MIMETYPES[targetFormat] === undefined) {
    targetFormat = "html";
  }
  const withContext = request.nextUrl.searchParams.get("context");
  const withSchema = request.nextUrl.searchParams.get("schema");
  const supabase = await createClient();
  const found = await findNode({ supabase, nodePath });
  if ("failure" in found) return createApiResponse(request, found.failure);
  const { space, concept, contents } = found;
  const platform = space.platform;
  const fullContents = contents.find((c) => c.variant === "full");
  const title = contents.find((c) => c.variant === "direct");

  const origin = request.nextUrl.origin;
  const ownSpaceUrl = spaceDataUrl({ origin, ...nodePath });
  const bodyUrl = nodeContentUrl({ origin, nodePath });
  let schemas: Record<number, Concept> = {};
  let authors: Record<number, PlatformAccount> = {};
  let relations: Concept[] = [];
  let schemaIds = new Set<number>();
  if (withContext) {
    const relationsResult = (await supabase
      .from("Concept")
      .select("relations:concept_in_relations!inner(*)")
      .eq("id", concept.id)
      .maybeSingle()) as PostgrestMaybeSingleResponse<{ relations: Concept[] }>;
    if (relationsResult.data?.relations?.length) {
      relations = relationsResult.data.relations;
      if (withSchema)
        schemaIds = new Set(
          relations.map((c) => c.schema_id).filter((id) => id !== null),
        );
    }
  }
  if (concept.schema_id) schemaIds.add(concept.schema_id);
  if (schemaIds.size > 0) {
    const schemaResponse = await supabase
      .from("Concept")
      .select()
      .in("id", [...schemaIds]);
    if (schemaResponse.error) {
      return createApiResponse(request, schemaResponse);
    }
    if (!schemaResponse.data) {
      return createApiResponse(
        request,
        asPostgrestFailure("Resource schema not found", "404", 404),
      );
    }
    schemas = Object.fromEntries(schemaResponse.data.map((s) => [s.id, s]));
  }
  const authorIds = new Set<number>([
    ...relations.map((r) => r.author_id).filter((id) => id !== null),
    ...Object.values(schemas)
      .map((s) => s.author_id)
      .filter((id) => id !== null),
  ]);
  if (concept.author_id) authorIds.add(concept.author_id);
  if (authorIds.size > 0) {
    try {
      const authorsResponse = await supabase
        .from("PlatformAccount")
        .select()
        .in("id", [...authorIds]);
      if (
        !authorsResponse.error &&
        authorsResponse.data &&
        authorsResponse.data.length > 0
      )
        authors = Object.fromEntries(
          authorsResponse.data.map((a) => [a.id, a]),
        );
    } catch (error) {
      // Anonymous readers may not see accounts; the node is served without them.
      console.error(error);
    }
  }

  const addresses = await loadConceptAddresses({
    supabase,
    origin,
    concepts: [concept, ...relations, ...Object.values(schemas)],
  });
  if ("failure" in addresses)
    return createApiResponse(request, addresses.failure);
  const isAddressed = (c: Concept): boolean =>
    addresses.iriOf(c.id) !== undefined;

  const relationsJLD = withContext
    ? relations.filter(isAddressed).map((c) =>
        asJsonLD({
          platform,
          concept: c,
          addresses,
          ownSpaceUrl,
          schema: c.schema_id ? schemas[c.schema_id] : undefined,
          author: c.author_id ? authors[c.author_id] : undefined,
        }),
      )
    : [];
  const schemasJLD = withSchema
    ? Object.values(schemas)
        .filter(isAddressed)
        .map((c) =>
          asJsonLD({
            platform,
            concept: c,
            addresses,
            ownSpaceUrl,
            author: c.author_id ? authors[c.author_id] : undefined,
          }),
        )
    : [];

  const baseJLDData = asJsonLD({
    platform,
    concept,
    addresses,
    ownSpaceUrl,
    title,
    schema: concept.schema_id ? schemas[concept.schema_id] : undefined,
    content: targetFormat === "none" ? undefined : fullContents,
    bodyUrl,
    author: concept.author_id ? authors[concept.author_id] : undefined,
    targetFormat: targetFormat === "none" ? undefined : targetFormat,
  });

  const jsonLdData =
    relationsJLD.length > 0 || schemasJLD.length > 0
      ? [baseJLDData, ...relationsJLD, ...schemasJLD]
      : baseJLDData;
  const documentUrl = nodeDataUrl({ origin, nodePath });
  return NextResponse.json(
    wrapJsonLd({ json: jsonLdData, ownSpaceUrl, documentUrl }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/ld+json",
        "Content-Location": documentUrl,
      },
    },
  );
};
