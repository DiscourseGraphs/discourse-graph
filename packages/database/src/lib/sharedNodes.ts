import type { DGSupabaseClient } from "./client";
import { ridToSpaceUriAndLocalId, spaceUriAndLocalIdToRid } from "./rid";
import type { Enums, Json, Tables } from "../dbTypes";

type SharedConcept = Pick<
  Tables<"my_concepts">,
  "is_schema" | "last_modified" | "schema_id" | "source_local_id" | "space_id"
>;
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

type ValidSharedSpace = {
  name: string;
  platform: Platform;
  url: string;
};

export type SharedNode = {
  rid: string;
  sourceLocalId: string;
  spaceId: number;
  spaceName: string;
  spaceUri: string;
  platform: Platform;
  title: string;
  created: string | null;
  lastModified: string;
  authorId?: number;
  directMetadata: Json;
};

export type SharedNodeRows = {
  nodes: SharedConcept[];
  directContents: SharedContent[];
  fullContentSummaries: SharedContentSummary[];
  spaces: SharedSpace[];
};

const CONCEPT_COLUMNS =
  "is_schema, last_modified, schema_id, source_local_id, space_id";
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
          space.platform === "Obsidian" ? "note" : undefined,
        );
      } catch {
        return [];
      }

      return [
        {
          rid,
          sourceLocalId: node.source_local_id,
          spaceId: node.space_id,
          spaceName: space.name,
          spaceUri: space.url,
          platform: space.platform,
          title: direct.text,
          created,
          lastModified,
          authorId: direct.author_id ?? undefined,
          directMetadata: direct.metadata,
        },
      ];
    })
    .sort(
      (left, right) =>
        Date.parse(right.lastModified) - Date.parse(left.lastModified) ||
        left.title.localeCompare(right.title),
    );
};

const getSharedNodeRows = async ({
  client,
  currentSpaceId,
}: {
  client: DGSupabaseClient;
  currentSpaceId: number;
}): Promise<SharedNodeRows> => {
  const [conceptsResponse, directResponse, fullResponse, spacesResponse] =
    await Promise.all([
      client
        .from("my_concepts")
        .select(CONCEPT_COLUMNS)
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
      client.from("my_spaces").select(SPACE_COLUMNS).neq("id", currentSpaceId),
    ]);
  if (conceptsResponse.error) throw conceptsResponse.error;
  if (directResponse.error) throw directResponse.error;
  if (fullResponse.error) throw fullResponse.error;
  if (spacesResponse.error) throw spacesResponse.error;

  return {
    nodes: conceptsResponse.data,
    directContents: directResponse.data,
    fullContentSummaries: fullResponse.data,
    spaces: spacesResponse.data,
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
      .select(CONCEPT_COLUMNS)
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

  const [sharedNode] = buildSharedNodes({
    nodes: conceptsResponse.data,
    directContents: directResponse.data,
    fullContentSummaries: fullResponse.data,
    spaces: [space],
  });
  return sharedNode ?? null;
};
