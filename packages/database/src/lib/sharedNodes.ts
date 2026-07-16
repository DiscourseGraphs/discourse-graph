import type { DGSupabaseClient } from "./client";
import { getAvailableGroupIds } from "./groups";
import { getAllPages } from "./pagination";
import { isRid, spaceUriAndLocalIdToRid } from "./rid";
import type { Enums, Json, Tables } from "../dbTypes";

const PAGE_SIZE = 1000;
const RESOURCE_ID_CHUNK_SIZE = 100;

type ResourceAccess = Pick<
  Tables<"ResourceAccess">,
  "space_id" | "source_local_id"
>;
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

export type SharedNodeCandidate = {
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
  concepts: SharedConcept[];
  directContents: SharedContent[];
  fullContentSummaries: SharedContentSummary[];
  resources: ResourceAccess[];
  spaces: SharedSpace[];
};

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

export const buildSharedNodeCandidates = ({
  concepts,
  currentSpaceId,
  directContents,
  fullContentSummaries,
  resources,
  spaces,
}: SharedNodeRows & {
  currentSpaceId: number;
}): SharedNodeCandidate[] => {
  const sharedResourceKeys = new Set(
    resources
      .filter((resource) => resource.space_id !== currentSpaceId)
      .map((resource) =>
        getResourceKey({
          sourceLocalId: resource.source_local_id,
          spaceId: resource.space_id,
        }),
      ),
  );
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

  return concepts
    .flatMap((concept): SharedNodeCandidate[] => {
      if (
        concept.is_schema !== false ||
        concept.schema_id === null ||
        typeof concept.space_id !== "number" ||
        typeof concept.source_local_id !== "string"
      )
        return [];

      const resourceKey = getResourceKey({
        sourceLocalId: concept.source_local_id,
        spaceId: concept.space_id,
      });
      if (!sharedResourceKeys.has(resourceKey)) return [];

      const space = spacesById.get(concept.space_id);
      const direct = directByResource.get(resourceKey);
      if (!space || typeof direct?.text !== "string") return [];

      const lastModified = getLatestTimestamp([
        concept.last_modified,
        direct.last_modified,
        fullModifiedByResource.get(resourceKey) ?? null,
      ]);
      if (!lastModified) return [];

      let rid: string;
      try {
        rid = isRid(concept.source_local_id)
          ? concept.source_local_id
          : spaceUriAndLocalIdToRid(
              space.url,
              concept.source_local_id,
              space.platform === "Obsidian" ? "note" : undefined,
            );
      } catch {
        return [];
      }

      return [
        {
          rid,
          sourceLocalId: concept.source_local_id,
          spaceId: concept.space_id,
          spaceName: space.name,
          spaceUri: space.url,
          platform: space.platform,
          title: direct.text,
          created: normalizeUtcTimestamp(direct.created),
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

const getGroupSharedResources = async (
  client: DGSupabaseClient,
  currentSpaceId: number,
  groupIds?: string[],
): Promise<ResourceAccess[]> => {
  const availableGroupIds = groupIds ?? (await getAvailableGroupIds(client));
  if (availableGroupIds.length === 0) return [];

  const resources = await getAllPages(
    client
      .from("ResourceAccess")
      .select("space_id, source_local_id")
      .in("account_uid", availableGroupIds)
      .neq("space_id", currentSpaceId)
      .order("space_id")
      .order("source_local_id")
      .order("account_uid"),
    PAGE_SIZE,
  );
  if (!Array.isArray(resources)) throw resources;

  return [
    ...new Map(
      resources.map((resource) => [
        getResourceKey({
          sourceLocalId: resource.source_local_id,
          spaceId: resource.space_id,
        }),
        resource,
      ]),
    ).values(),
  ];
};

const chunk = <T>(values: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );

const getSharedNodeRows = async ({
  client,
  currentSpaceId,
  groupIds,
}: {
  client: DGSupabaseClient;
  currentSpaceId: number;
  groupIds?: string[];
}): Promise<SharedNodeRows> => {
  const resources = await getGroupSharedResources(
    client,
    currentSpaceId,
    groupIds,
  );
  if (resources.length === 0)
    return {
      concepts: [],
      directContents: [],
      fullContentSummaries: [],
      resources,
      spaces: [],
    };

  const spaceIds = [...new Set(resources.map((resource) => resource.space_id))];
  const spacesResponse = await client
    .from("my_spaces")
    .select("id, name, platform, url")
    .in("id", spaceIds);
  if (spacesResponse.error) throw spacesResponse.error;

  const concepts: SharedConcept[] = [];
  const directContents: SharedContent[] = [];
  const fullContentSummaries: SharedContentSummary[] = [];
  for (const spaceId of spaceIds) {
    const sourceLocalIds = resources
      .filter((resource) => resource.space_id === spaceId)
      .map((resource) => resource.source_local_id);
    for (const ids of chunk(sourceLocalIds, RESOURCE_ID_CHUNK_SIZE)) {
      const [conceptsResponse, directResponse, fullResponse] =
        await Promise.all([
          client
            .from("my_concepts")
            .select(
              "is_schema, last_modified, schema_id, source_local_id, space_id",
            )
            .eq("space_id", spaceId)
            .eq("is_schema", false)
            .eq("arity", 0)
            .in("source_local_id", ids),
          client
            .from("my_contents")
            .select(
              "author_id, created, last_modified, metadata, source_local_id, space_id, text, variant",
            )
            .eq("space_id", spaceId)
            .in("source_local_id", ids)
            .eq("variant", "direct"),
          client
            .from("my_contents")
            .select("last_modified, source_local_id, space_id")
            .eq("space_id", spaceId)
            .in("source_local_id", ids)
            .eq("variant", "full"),
        ]);
      if (conceptsResponse.error) throw conceptsResponse.error;
      if (directResponse.error) throw directResponse.error;
      if (fullResponse.error) throw fullResponse.error;
      concepts.push(...conceptsResponse.data);
      directContents.push(...directResponse.data);
      fullContentSummaries.push(...fullResponse.data);
    }
  }

  return {
    concepts,
    directContents,
    fullContentSummaries,
    resources,
    spaces: spacesResponse.data,
  };
};

export const listGroupSharedNodes = async ({
  client,
  currentSpaceId,
  groupIds,
}: {
  client: DGSupabaseClient;
  currentSpaceId: number;
  groupIds?: string[];
}): Promise<SharedNodeCandidate[]> => {
  const rows = await getSharedNodeRows({ client, currentSpaceId, groupIds });
  return buildSharedNodeCandidates({ ...rows, currentSpaceId });
};
