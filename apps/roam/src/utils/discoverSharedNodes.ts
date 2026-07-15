import type { DGSupabaseClient } from "@repo/database/lib/client";
import { getAvailableGroupIds } from "@repo/database/lib/groups";
import { getAllPages } from "@repo/database/lib/pagination";
import { isRid, spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import type { Enums, Tables } from "@repo/database/dbTypes";
import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";

const IMPORTED_FROM_PROP_KEY = "importedFrom";
const PAGE_SIZE = 1000;
const RESOURCE_ID_CHUNK_SIZE = 100;
const TIMEZONE_SUFFIX = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

type Platform = Enums<"Platform">;

type ResourceAccess = Pick<
  Tables<"ResourceAccess">,
  "space_id" | "source_local_id"
>;
type SharedConcept = Pick<
  Tables<"my_concepts">,
  "is_schema" | "last_modified" | "schema_id" | "source_local_id" | "space_id"
>;
type SharedDirectContent = Pick<
  Tables<"my_contents">,
  "last_modified" | "source_local_id" | "space_id" | "text"
>;
type SharedFullContentSummary = Pick<
  Tables<"my_contents">,
  "content_type" | "last_modified" | "source_local_id" | "space_id"
>;
type SharedSpace = Pick<
  Tables<"my_spaces">,
  "id" | "name" | "platform" | "url"
>;
type ValidSharedSpace = {
  name: string;
  platform: Platform;
  url: string;
};

export type DiscoveredSharedNode = {
  alreadyImported: boolean;
  modifiedAt: string;
  sourceApp: Platform;
  sourceNodeId?: string;
  sourceNodeRid: string;
  sourceSpaceId: string;
  sourceSpaceName: string;
  title: string;
};

type SharedNodeRows = {
  concepts: SharedConcept[];
  directContents: SharedDirectContent[];
  fullContentSummaries: SharedFullContentSummary[];
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
  if (typeof timestamp !== "string") return null;
  const timestampWithTimezone = TIMEZONE_SUFFIX.test(timestamp)
    ? timestamp
    : `${timestamp}Z`;
  const date = new Date(timestampWithTimezone);
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

const indexContentByResource = <
  T extends { source_local_id: string | null; space_id: number | null },
>(
  contents: T[],
): Map<string, T> =>
  new Map(
    contents.flatMap((content): [string, T][] => {
      if (
        typeof content.space_id !== "number" ||
        typeof content.source_local_id !== "string"
      )
        return [];
      return [
        [
          getResourceKey({
            sourceLocalId: content.source_local_id,
            spaceId: content.space_id,
          }),
          content,
        ],
      ];
    }),
  );

export const buildDiscoveredSharedNodes = ({
  concepts,
  directContents,
  fullContentSummaries,
  currentSpaceId,
  importedSourceRids,
  resources,
  spaces,
}: SharedNodeRows & {
  currentSpaceId: number;
  importedSourceRids: ReadonlySet<string>;
}): DiscoveredSharedNode[] => {
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
        (space.platform !== "Roam" && space.platform !== "Obsidian") ||
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
  const directContentByResource = indexContentByResource(directContents);
  const fullContentSummaryByResource =
    indexContentByResource(fullContentSummaries);

  return concepts
    .flatMap((concept): DiscoveredSharedNode[] => {
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
      const direct = directContentByResource.get(resourceKey);
      const full = fullContentSummaryByResource.get(resourceKey);
      if (
        !space ||
        typeof direct?.text !== "string" ||
        (full !== undefined && typeof full.content_type !== "string")
      )
        return [];

      const modifiedAt = getLatestTimestamp([
        concept.last_modified,
        direct.last_modified,
        full?.last_modified ?? null,
      ]);
      if (!modifiedAt) return [];

      let sourceNodeRid: string;
      try {
        sourceNodeRid = isRid(concept.source_local_id)
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
          alreadyImported: importedSourceRids.has(sourceNodeRid),
          modifiedAt,
          sourceApp: space.platform,
          sourceNodeId: concept.source_local_id || undefined,
          sourceNodeRid,
          sourceSpaceId: space.url,
          sourceSpaceName: space.name,
          title: direct.text,
        },
      ];
    })
    .sort(
      (left, right) =>
        Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt) ||
        left.title.localeCompare(right.title),
    );
};

const getGroupSharedResources = async (
  client: DGSupabaseClient,
): Promise<ResourceAccess[]> => {
  const groupIds = await getAvailableGroupIds(client);
  if (groupIds.length === 0) return [];

  const resources = await getAllPages(
    client
      .from("ResourceAccess")
      .select("space_id, source_local_id")
      .in("account_uid", groupIds)
      .order("account_uid")
      .order("source_local_id")
      .order("space_id"),
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
}: {
  client: DGSupabaseClient;
  currentSpaceId: number;
}): Promise<SharedNodeRows> => {
  const resources = (await getGroupSharedResources(client)).filter(
    (resource) => resource.space_id !== currentSpaceId,
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
  const directContents: SharedDirectContent[] = [];
  const fullContentSummaries: SharedFullContentSummary[] = [];
  for (const spaceId of spaceIds) {
    const sourceLocalIds = resources
      .filter((resource) => resource.space_id === spaceId)
      .map((resource) => resource.source_local_id);
    for (const ids of chunk(sourceLocalIds, RESOURCE_ID_CHUNK_SIZE)) {
      const [conceptsResponse, directContentsResponse, fullContentsResponse] =
        await Promise.all([
          client
            .from("my_concepts")
            .select(
              "is_schema, last_modified, schema_id, source_local_id, space_id",
            )
            .eq("space_id", spaceId)
            .eq("is_schema", false)
            .in("source_local_id", ids),
          client
            .from("my_contents")
            .select("last_modified, source_local_id, space_id, text")
            .eq("space_id", spaceId)
            .in("source_local_id", ids)
            .eq("variant", "direct"),
          client
            .from("my_contents")
            .select("content_type, last_modified, source_local_id, space_id")
            .eq("space_id", spaceId)
            .in("source_local_id", ids)
            .eq("variant", "full"),
        ]);
      if (conceptsResponse.error) throw conceptsResponse.error;
      if (directContentsResponse.error) throw directContentsResponse.error;
      if (fullContentsResponse.error) throw fullContentsResponse.error;
      concepts.push(...conceptsResponse.data);
      directContents.push(...directContentsResponse.data);
      fullContentSummaries.push(...fullContentsResponse.data);
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

const getImportedSourceRids = async (): Promise<Set<string>> => {
  const query = `[:find [?rid ...]
    :where
      [?page :block/props ?props]
      [(get ?props :${DISCOURSE_GRAPH_PROP_NAME}) ?dgData]
      [(get ?dgData :${IMPORTED_FROM_PROP_KEY}) ?imported]
      [(get ?imported :sourceNodeRid) ?rid]]`;
  const result = (await window.roamAlphaAPI.data.async.q(query)) as unknown[];
  return new Set(
    result.filter((rid): rid is string => typeof rid === "string"),
  );
};

export const discoverSharedNodes = async ({
  client,
  currentSpaceId,
}: {
  client: DGSupabaseClient;
  currentSpaceId: number;
}): Promise<DiscoveredSharedNode[]> => {
  const [rows, importedSourceRids] = await Promise.all([
    getSharedNodeRows({ client, currentSpaceId }),
    getImportedSourceRids(),
  ]);
  return buildDiscoveredSharedNodes({
    ...rows,
    currentSpaceId,
    importedSourceRids,
  });
};
