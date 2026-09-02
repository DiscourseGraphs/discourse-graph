import type { DGSupabaseClient } from "./client";
import { ridToSpaceUriAndLocalId, spaceUriAndLocalIdToRid } from "./rid";
import type { Enums, Json, Tables } from "../dbTypes";

type SharedConcept = Pick<
  Tables<"my_concepts">,
  | "is_schema"
  | "last_modified"
  | "schema_id"
  | "source_local_id"
  | "space_id"
  | "reference_content"
> & {
  core_title: string | null;
  concepts_of_relation: {
    id: number | null;
    space_id: number | null;
    source_local_id: string | null;
  }[];
};
type SharedContent = Pick<
  Tables<"my_contents">,
  | "author_id"
  | "created"
  | "last_modified"
  | "metadata"
  | "source_local_id"
  | "space_id"
  | "text"
  | "variant"
>;
type SharedContentSummary = Pick<
  Tables<"my_contents">,
  "last_modified" | "source_local_id" | "space_id"
>;
type SharedSpace = Pick<
  Tables<"my_spaces">,
  "id" | "name" | "platform" | "url"
>;
type Platform = Enums<"Platform">;

const nodeRidSubtype = (platform: Platform): string | undefined =>
  platform === "Obsidian" ? "note" : undefined;

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

export type SharedNodeRows = {
  nodes: SharedConcept[];
  directContents: SharedContent[];
  fullContentSummaries: SharedContentSummary[];
  spaces: SharedSpace[];
};

const CONCEPT_COLUMNS_WITH_SLOTS =
  "core_title:literal_content->>core_title, is_schema, last_modified, schema_id, source_local_id, space_id, reference_content, concepts_of_relation(id, space_id, source_local_id)";
const DIRECT_CONTENT_COLUMNS =
  "author_id, created, last_modified, metadata, source_local_id, space_id, text, variant";
const FULL_CONTENT_SUMMARY_COLUMNS = "last_modified, source_local_id, space_id";
const SPACE_COLUMNS = "id, name, platform, url";

const getResourceKey = ({
  sourceLocalId,
  spaceId,
}: {
  sourceLocalId: string;
  spaceId: number;
}): string => `${spaceId}:${sourceLocalId}`;

const normalizeUtcTimestamp = (timestamp: string | null): string | null => {
  if (!timestamp) return null;
  const date = new Date(`${timestamp}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getLatestTimestamp = (timestamps: (string | null)[]): string | null => {
  const validTimestamps = timestamps
    .map(normalizeUtcTimestamp)
    .filter((timestamp): timestamp is string => typeof timestamp === "string");
  if (validTimestamps.length === 0) return null;
  return validTimestamps.reduce((latest, timestamp) =>
    timestamp > latest ? timestamp : latest,
  );
};

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
  const directByResource = new Map<string, SharedContent>();
  directContents.forEach((content) => {
    if (
      typeof content.space_id !== "number" ||
      typeof content.source_local_id !== "string" ||
      content.variant !== "direct"
    )
      return;
    directByResource.set(
      getResourceKey({
        sourceLocalId: content.source_local_id,
        spaceId: content.space_id,
      }),
      content,
    );
  });

  const fullModifiedByResource = new Map<string, string | null>();
  fullContentSummaries.forEach((summary) => {
    if (
      typeof summary.space_id !== "number" ||
      typeof summary.source_local_id !== "string"
    )
      return;
    fullModifiedByResource.set(
      getResourceKey({
        sourceLocalId: summary.source_local_id,
        spaceId: summary.space_id,
      }),
      summary.last_modified,
    );
  });

  return nodes
    .flatMap((node): SharedNode[] => {
      if (
        node.is_schema !== false ||
        node.schema_id === null ||
        typeof node.space_id !== "number" ||
        typeof node.source_local_id !== "string"
      )
        return [];

      const resourceKey = getResourceKey({
        sourceLocalId: node.source_local_id,
        spaceId: node.space_id,
      });

      const space = spacesById.get(node.space_id);
      const direct = directByResource.get(resourceKey);
      if (!space || typeof direct?.text !== "string") return [];

      const created = normalizeUtcTimestamp(direct.created);
      const lastModified =
        getLatestTimestamp([
          node.last_modified,
          direct.last_modified,
          fullModifiedByResource.get(resourceKey) ?? null,
        ]) ?? created;
      if (!lastModified) return [];

      let rid: string;
      try {
        rid = spaceUriAndLocalIdToRid(
          space.url,
          node.source_local_id,
          nodeRidSubtype(space.platform),
        );
      } catch {
        return [];
      }

      const nodeRidById = Object.fromEntries(
        node.concepts_of_relation
          .filter((c) => c.id !== null)
          .map((c) => {
            if (c.space_id === node.space_id) return [c.id, c.source_local_id];
            const space = spacesById.get(c.space_id || 0);
            if (!space || !c.source_local_id || !c.id) return [c.id, undefined];
            return [
              c.id,
              spaceUriAndLocalIdToRid(
                space.url,
                c.source_local_id,
                nodeRidSubtype(space.platform),
              ),
            ];
          }) as [number, string | undefined][],
      );
      const referenceContent = (node.reference_content ?? {}) as Record<
        string,
        number
      >;
      const slots = Object.fromEntries(
        Object.entries(referenceContent ?? {})
          .map(([k, v]) => [k, nodeRidById[v]])
          .filter(([, v]) => v !== undefined) as [string, string][],
      );

      return [
        {
          rid,
          sourceLocalId: node.source_local_id,
          schemaId: node.schema_id,
          spaceId: node.space_id,
          spaceName: space.name,
          spaceUri: space.url,
          platform: space.platform,
          title: direct.text,
          coreTitle: node.core_title ?? undefined,
          created,
          lastModified,
          authorId: direct.author_id ?? undefined,
          directMetadata: direct.metadata,
          slots: Object.keys(slots).length > 0 ? slots : undefined,
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
  concepts: SharedConcept[];
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
