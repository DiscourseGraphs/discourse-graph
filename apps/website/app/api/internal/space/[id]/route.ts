import { NextResponse, NextRequest } from "next/server";

import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import type { Json, Tables } from "@repo/database/dbTypes";
import { CrossAppUpsertData } from "@repo/database/crossAppContracts";
import { LocalConceptDataInput } from "@repo/database/inputTypes";
import {
  crossAppNodeSchemaToDbConcept,
  crossAppNodeToDbConcept,
  crossAppRelationToDbConcept,
  crossAppRelationTripleSchemaToDbConcept,
  crossAppRelationTypeSchemaToDbConcept,
  dbNodeSchemaToCrossApp,
  dbRelationTypeSchemaToCrossApp,
} from "@repo/database/lib/crossAppConverters";
import { getAccountId } from "~/utils/supabase/account";

type Concept = Tables<"Concept">;

type ApiParams = Promise<{ id: string }>;
export type SegmentDataType = { params: ApiParams };

export const POST = async (
  request: NextRequest,
  segmentData: SegmentDataType,
): Promise<NextResponse> => {
  const { id: spaceIdS } = await segmentData.params;
  const spaceId = Number.parseInt(spaceIdS);
  if (Number.isNaN(spaceId))
    return createApiResponse(
      request,
      asPostgrestFailure("Cannot parse space id", "invalid", 403),
    );

  try {
    const supabase = await createClient();
    const userId = await getAccountId(supabase);
    if (userId === undefined)
      return createApiResponse(
        request,
        asPostgrestFailure("Please login", "invalid", 401),
      );
    const body = (await request.json()) as CrossAppUpsertData;
    // TODO: Zed validator
    const nodeSchemasById = Object.fromEntries(
      (body.nodeSchemas || []).map((c) => [c.localId, c]),
    );
    const relationTypesById = Object.fromEntries(
      (body.relationTypeSchemas || []).map((c) => [c.localId, c]),
    );
    const neededNodesSchemaIds = new Set(
      (body.relationTripleSchemas || [])
        .map((c) => [c.sourceType, c.destinationType])
        .flat(),
    );
    const neededRelationTypeSchemaIds = new Set(
      (body.relationTripleSchemas || [])
        .map((c) => c.relation)
        .filter((c) => c !== undefined),
    );
    const missingNodeSchemaIds = [...neededNodesSchemaIds].filter(
      (id) => !(id in nodeSchemasById),
    );
    const missingRelationTypeSchemaIds = [
      ...neededRelationTypeSchemaIds,
    ].filter((id) => !(id in relationTypesById));
    const missingSchemaIds = [
      ...missingNodeSchemaIds,
      ...missingRelationTypeSchemaIds,
    ];
    if (missingSchemaIds.length > 0) {
      const schemaResult = await supabase
        .from("my_concepts")
        .select()
        .in("source_local_id", missingSchemaIds)
        .eq("space_id", spaceId);
      if (schemaResult.error) return createApiResponse(request, schemaResult);
      if (schemaResult.data.length < missingSchemaIds.length)
        throw new Error("Reference to inexistant schemas");
      const authorLocalIds = new Set(
        schemaResult.data.map((c) => c.author_id).filter((id) => id !== null),
      );
      const authorRes = await supabase
        .from("my_accounts")
        .select("id, account_local_id")
        .in("id", [...authorLocalIds]);
      if (authorRes.error) return createApiResponse(request, authorRes);
      const authorMap: Record<number, string> = Object.fromEntries(
        authorRes.data
          .filter((r) => r.id !== null && r.account_local_id !== null)
          .map((r) => [r.id!, r.account_local_id!]),
      );
      schemaResult.data
        .filter((d) => d.arity === 0)
        .map((d) => {
          const c = dbNodeSchemaToCrossApp(d as Concept, authorMap);
          nodeSchemasById[c.localId] = c;
        });
      schemaResult.data
        .filter((d) => d.arity === 0)
        .map((d) => {
          const c = dbRelationTypeSchemaToCrossApp(d as Concept, authorMap);
          relationTypesById[c.localId] = c;
        });
    }
    const content: LocalConceptDataInput[] = [
      ...(body.nodeSchemas || []).map((c) =>
        crossAppNodeSchemaToDbConcept({
          ...c,
          createdAt: new Date(c.createdAt),
          modifiedAt: new Date(c.modifiedAt || c.createdAt),
        }),
      ),
      ...(body.relationTypeSchemas || []).map((c) =>
        crossAppRelationTypeSchemaToDbConcept({
          ...c,
          createdAt: new Date(c.createdAt),
          modifiedAt: new Date(c.modifiedAt || c.createdAt),
        }),
      ),
      ...(body.relationTripleSchemas || []).map((c) =>
        crossAppRelationTripleSchemaToDbConcept({
          node: {
            ...c,
            createdAt: new Date(c.createdAt),
            modifiedAt: new Date(c.modifiedAt || c.createdAt),
          },
          sourceNodeSchema: nodeSchemasById[c.sourceType]!,
          destinationNodeSchema: nodeSchemasById[c.destinationType]!,
          relationType: relationTypesById[c.relation || ""],
        }),
      ),
      ...(body.nodes || []).map((c) =>
        crossAppNodeToDbConcept({
          ...c,
          createdAt: new Date(c.createdAt),
          modifiedAt: new Date(c.modifiedAt || c.createdAt),
        }),
      ),
      ...(body.relations || []).map((c) =>
        crossAppRelationToDbConcept({
          ...c,
          createdAt: new Date(c.createdAt),
          modifiedAt: new Date(c.modifiedAt || c.createdAt),
        }),
      ),
    ].filter((c) => c !== undefined);
    if (content.length === 0) throw new Error("Could not translate content");
    const result = await supabase.rpc("upsert_concepts", {
      data: content as Json,
      v_space_id: spaceId,
      v_creator_id: userId,
      content_as_document: true,
    });
    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/space/[id]");
  }
};

export const OPTIONS = defaultOptionsHandler;
