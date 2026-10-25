import type { DGSupabaseClient } from "./client";
import { ridToSpaceUriAndLocalId } from "./rid";
import {
  groupDbNodeRows,
  resolveDbNode,
  type DbNodeConcept,
  type DbNodeRows,
  type ResolvedDbNode,
} from "./dbToCrossAppConverters";
import type { Enums, Json, Tables } from "../dbTypes";

type SharedSpace = Pick<
  Tables<"my_spaces">,
  "id" | "name" | "platform" | "url"
>;
type Platform = Enums<"Platform">;

type ValidSharedSpace = {
  name: string;
  platform: Platform;
  url: string;
};

export type SharedNode = {
  rid: string;
  sourceLocalId: string;
  schemaId: number;
  spaceId: number;
  spaceName: string;
  spaceUri: string;
  platform: Platform;
  title: string;
  coreTitle?: string;
  created: string | null;
  lastModified: string;
  authorId?: number;
  directMetadata: Json;
  slots?: Record<string, string>;
};

export type SharedNodeRows = DbNodeRows & {
  spaces: SharedSpace[];
};

const CONCEPT_COLUMNS_WITH_SLOTS =
  "core_title:literal_content->>core_title, is_schema, last_modified, schema_id, source_local_id, space_id, reference_content, concepts_of_relation(id, space_id, source_local_id)";
const DIRECT_CONTENT_COLUMNS =
  "author_id, created, last_modified, metadata, source_local_id, space_id, text, variant";
const FULL_CONTENT_SUMMARY_COLUMNS = "last_modified, source_local_id, space_id";
const SPACE_COLUMNS = "id, name, platform, url";

export const buildSharedNodes = ({
  nodes,
  directContents,
  fullContentSummaries,
  spaces,
}: SharedNodeRows): SharedNode[] => {
  const spacesById = new Map<number, ValidSharedSpace>(
    spaces.flatMap((space): [number, ValidSharedSpace][] => {
      if (
        typeof space.id !== "number" ||
        typeof space.name !== "string" ||
        space.platform === null ||
        typeof space.url !== "string"
      )
        return [];
      return [
        [
          space.id,
          {
            name: space.name,
            platform: space.platform,
            url: space.url,
          },
        ],
      ];
    }),
  );
  const spaceMap = Object.fromEntries(
    [...spacesById].map(([id, space]) => [id, space.url]),
  );

  return groupDbNodeRows({ nodes, directContents, fullContentSummaries })
    .flatMap((row): SharedNode[] => {
      let resolved: ResolvedDbNode;
      try {
        resolved = resolveDbNode({ row, spaceMap });
      } catch {
        return [];
      }
      const space = spacesById.get(resolved.spaceId)!;

      return [
        {
          rid: resolved.rid,
          sourceLocalId: resolved.localId,
          schemaId: resolved.schemaId,
          spaceId: resolved.spaceId,
          spaceName: space.name,
          spaceUri: space.url,
          platform: space.platform,
          title: resolved.title,
          coreTitle: row.concept.core_title ?? undefined,
          created: resolved.created,
          lastModified: resolved.modifiedAt,
          authorId: resolved.direct.author_id ?? undefined,
          directMetadata: resolved.direct.metadata,
          slots: resolved.slots,
        },
      ];
    })
    .sort(
      (left, right) =>
        Date.parse(right.lastModified) - Date.parse(left.lastModified) ||
        left.title.localeCompare(right.title),
    );
};

const getAssociatedSpaces = async ({
  client,
  concepts,
  currentSpace,
  currentSpaceId,
}: {
  client: DGSupabaseClient;
  concepts: DbNodeConcept[];
  currentSpace?: SharedSpace;
  currentSpaceId?: number;
}): Promise<SharedSpace[]> => {
  const associatedSpaceIds = new Set(
    [
      ...concepts.map((cpt) => cpt.space_id),
      ...concepts.flatMap((cpt) =>
        cpt.concepts_of_relation.map((cr) => cr.space_id),
      ),
    ].filter((id) => id !== null),
  );
  if (currentSpace !== undefined) {
    currentSpaceId = currentSpace.id ?? currentSpaceId;
  } else if (currentSpaceId !== undefined)
    associatedSpaceIds.add(currentSpaceId);
  const spaces: SharedSpace[] = [];
  if (currentSpace !== undefined && currentSpaceId !== undefined) {
    spaces.push(currentSpace);
    associatedSpaceIds.delete(currentSpaceId);
  }
  if (associatedSpaceIds.size > 0) {
    const { data, error } = await client
      .from("my_spaces")
      .select(SPACE_COLUMNS)
      .in("id", [...associatedSpaceIds]);
    if (error) throw error;
    spaces.push(...data);
  }
  return spaces;
};

const getSharedNodeRows = async ({
  client,
  currentSpaceId,
}: {
  client: DGSupabaseClient;
  currentSpaceId: number;
}): Promise<SharedNodeRows> => {
  const [conceptsResponse, directResponse, fullResponse] = await Promise.all([
    client
      .from("my_concepts")
      .select(CONCEPT_COLUMNS_WITH_SLOTS)
      .neq("space_id", currentSpaceId)
      .eq("is_schema", false)
      .eq("is_relation", false),
    client
      .from("my_contents")
      .select(DIRECT_CONTENT_COLUMNS)
      .neq("space_id", currentSpaceId)
      .eq("variant", "direct"),
    client
      .from("my_contents")
      .select(FULL_CONTENT_SUMMARY_COLUMNS)
      .neq("space_id", currentSpaceId)
      .eq("variant", "full"),
  ]);
  if (conceptsResponse.error) throw conceptsResponse.error;
  if (directResponse.error) throw directResponse.error;
  if (fullResponse.error) throw fullResponse.error;
  const spaces = await getAssociatedSpaces({
    client,
    concepts: conceptsResponse.data,
    currentSpaceId,
  });

  return {
    nodes: conceptsResponse.data,
    directContents: directResponse.data,
    fullContentSummaries: fullResponse.data,
    spaces,
  };
};

export const listGroupSharedNodes = async ({
  client,
  currentSpaceId,
}: {
  client: DGSupabaseClient;
  currentSpaceId: number;
}): Promise<SharedNode[]> => {
  const rows = await getSharedNodeRows({ client, currentSpaceId });
  return buildSharedNodes(rows);
};

export const getSharedNodeByRid = async ({
  client,
  rid,
}: {
  client: DGSupabaseClient;
  rid: string;
}): Promise<SharedNode | null> => {
  const { spaceUri, sourceLocalId } = ridToSpaceUriAndLocalId(rid);
  const spaceResponse = await client
    .from("my_spaces")
    .select(SPACE_COLUMNS)
    .eq("url", spaceUri)
    .maybeSingle();
  if (spaceResponse.error) throw spaceResponse.error;
  const space = spaceResponse.data;
  if (!space || typeof space.id !== "number") return null;

  const [conceptsResponse, directResponse, fullResponse] = await Promise.all([
    client
      .from("my_concepts")
      .select(CONCEPT_COLUMNS_WITH_SLOTS)
      .eq("space_id", space.id)
      .eq("source_local_id", sourceLocalId)
      .eq("is_schema", false)
      .eq("is_relation", false),
    client
      .from("my_contents")
      .select(DIRECT_CONTENT_COLUMNS)
      .eq("space_id", space.id)
      .eq("source_local_id", sourceLocalId)
      .eq("variant", "direct"),
    client
      .from("my_contents")
      .select(FULL_CONTENT_SUMMARY_COLUMNS)
      .eq("space_id", space.id)
      .eq("source_local_id", sourceLocalId)
      .eq("variant", "full"),
  ]);
  if (conceptsResponse.error) throw conceptsResponse.error;
  if (directResponse.error) throw directResponse.error;
  if (fullResponse.error) throw fullResponse.error;
  const spaces = await getAssociatedSpaces({
    client,
    concepts: conceptsResponse.data,
    currentSpace: space,
  });

  const [sharedNode] = buildSharedNodes({
    nodes: conceptsResponse.data,
    directContents: directResponse.data,
    fullContentSummaries: fullResponse.data,
    spaces,
  });
  return sharedNode ?? null;
};
