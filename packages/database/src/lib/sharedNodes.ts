import { isSupportedContentType } from "@repo/content-model";
import type { CrossAppNode } from "../crossAppContracts";
import type { DGSupabaseClient } from "./client";
import { getAvailableGroupIds } from "./groups";
import { getAllPages } from "./pagination";
import { spaceUriAndLocalIdToRid } from "./rid";
import type { Json, Tables } from "../dbTypes";

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
  | "content_type"
  | "created"
  | "last_modified"
  | "metadata"
  | "source_local_id"
  | "space_id"
  | "text"
  | "variant"
>;
type SharedSpace = Pick<
  Tables<"my_spaces">,
  "id" | "name" | "platform" | "url"
>;
type SharedNodePayloadConcept = Pick<
  Tables<"my_concepts">,
  "author_id" | "created" | "last_modified" | "schema_id" | "source_local_id"
>;
type SharedNodePayloadContent = Pick<
  Tables<"my_contents">,
  | "author_id"
  | "content_type"
  | "created"
  | "last_modified"
  | "text"
  | "variant"
>;
type ValidSharedSpace = {
  name: string;
  platform: "Roam" | "Obsidian";
  url: string;
};

export type SharedNodeCandidate = {
  rid: string;
  sourceLocalId: string;
  spaceId: number;
  spaceName: string;
  spaceUri: string;
  platform: "Roam" | "Obsidian";
  title: string;
  created: string | null;
  lastModified: string;
  authorId?: number;
  directMetadata: Json;
};

export type SharedNodeRows = {
  concepts: SharedConcept[];
  contents: SharedContent[];
  resources: ResourceAccess[];
  spaces: SharedSpace[];
};

const getValidDate = (values: (string | null)[]): Date | undefined => {
  const value = values.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && !Number.isNaN(Date.parse(candidate)),
  );
  return value ? new Date(value) : undefined;
};

export const buildSharedNodePayload = ({
  concept,
  contents,
}: {
  concept: SharedNodePayloadConcept;
  contents: SharedNodePayloadContent[];
}): CrossAppNode => {
  const direct = contents.find((content) => content.variant === "direct");
  const full = contents.find((content) => content.variant === "full");
  const authorId = concept.author_id ?? direct?.author_id ?? full?.author_id;
  const modifiedAt = getValidDate(
    [concept.last_modified, direct?.last_modified, full?.last_modified]
      .filter((value): value is string => typeof value === "string")
      .sort((left, right) => Date.parse(right) - Date.parse(left)),
  );
  const sourceCreatedAt = getValidDate([
    concept.created,
    direct?.created ?? null,
    full?.created ?? null,
  ]);

  if (typeof concept.source_local_id !== "string")
    throw new Error("Shared node is missing its source-local ID");
  if (typeof concept.schema_id !== "number")
    throw new Error("Shared node is missing its node type");
  if (typeof authorId !== "number")
    throw new Error("Shared node is missing its author");
  if (!modifiedAt) throw new Error("Shared node is missing its modified time");
  const createdAt = sourceCreatedAt ?? modifiedAt;
  if (typeof direct?.text !== "string")
    throw new Error("Shared node is missing its direct content");
  if (typeof full?.text !== "string")
    throw new Error("Shared node is missing its full content");
  if (
    typeof full.content_type !== "string" ||
    !isSupportedContentType(full.content_type)
  )
    throw new Error(
      `Shared node has unsupported full content type '${String(full.content_type)}'`,
    );

  return {
    author: { dbId: authorId },
    content: {
      direct: {
        value: direct.text,
        ...(typeof direct.content_type === "string" &&
        isSupportedContentType(direct.content_type)
          ? { contentType: direct.content_type }
          : {}),
      },
      full: {
        contentType: full.content_type,
        value: full.text,
      },
    },
    createdAt,
    localId: concept.source_local_id,
    modifiedAt,
    nodeType: { dbId: concept.schema_id },
  };
};

const getResourceKey = ({
  sourceLocalId,
  spaceId,
}: {
  sourceLocalId: string;
  spaceId: number;
}): string => `${spaceId}:${sourceLocalId}`;

const getLatestTimestamp = (timestamps: (string | null)[]): string | null => {
  const validTimestamps = timestamps.filter(
    (timestamp): timestamp is string =>
      typeof timestamp === "string" && !Number.isNaN(Date.parse(timestamp)),
  );
  if (validTimestamps.length === 0) return null;
  return validTimestamps.reduce((latest, timestamp) =>
    Date.parse(timestamp) > Date.parse(latest) ? timestamp : latest,
  );
};

export const buildSharedNodeCandidates = ({
  concepts,
  contents,
  currentSpaceId,
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
  const contentByResource = new Map<
    string,
    Partial<Record<"direct" | "full", SharedContent>>
  >();

  contents.forEach((content) => {
    if (
      typeof content.space_id !== "number" ||
      typeof content.source_local_id !== "string" ||
      (content.variant !== "direct" && content.variant !== "full")
    )
      return;
    const key = getResourceKey({
      sourceLocalId: content.source_local_id,
      spaceId: content.space_id,
    });
    const variants = contentByResource.get(key) ?? {};
    variants[content.variant] = content;
    contentByResource.set(key, variants);
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
      const variants = contentByResource.get(resourceKey);
      const direct = variants?.direct;
      const full = variants?.full;
      if (
        !space ||
        typeof direct?.text !== "string" ||
        typeof full?.text !== "string" ||
        typeof full.content_type !== "string"
      )
        return [];

      const lastModified = getLatestTimestamp([
        concept.last_modified,
        direct.last_modified,
        full.last_modified,
      ]);
      if (!lastModified) return [];

      let rid: string;
      try {
        rid = spaceUriAndLocalIdToRid(
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
          created: direct.created,
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
  groupIds?: string[],
): Promise<ResourceAccess[]> => {
  const availableGroupIds = groupIds ?? (await getAvailableGroupIds(client));
  if (availableGroupIds.length === 0) return [];

  const resources = await getAllPages(
    client
      .from("ResourceAccess")
      .select("space_id, source_local_id")
      .in("account_uid", availableGroupIds)
      .order("space_id")
      .order("source_local_id"),
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
  const resources = (await getGroupSharedResources(client, groupIds)).filter(
    (resource) => resource.space_id !== currentSpaceId,
  );
  if (resources.length === 0)
    return { concepts: [], contents: [], resources, spaces: [] };

  const spaceIds = [...new Set(resources.map((resource) => resource.space_id))];
  const spacesResponse = await client
    .from("my_spaces")
    .select("id, name, platform, url")
    .in("id", spaceIds);
  if (spacesResponse.error) throw spacesResponse.error;

  const concepts: SharedConcept[] = [];
  const contents: SharedContent[] = [];
  for (const spaceId of spaceIds) {
    const sourceLocalIds = resources
      .filter((resource) => resource.space_id === spaceId)
      .map((resource) => resource.source_local_id);
    for (const ids of chunk(sourceLocalIds, RESOURCE_ID_CHUNK_SIZE)) {
      const [conceptsResponse, contentsResponse] = await Promise.all([
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
          .select(
            "author_id, content_type, created, last_modified, metadata, source_local_id, space_id, text, variant",
          )
          .eq("space_id", spaceId)
          .in("source_local_id", ids)
          .in("variant", ["direct", "full"]),
      ]);
      if (conceptsResponse.error) throw conceptsResponse.error;
      if (contentsResponse.error) throw contentsResponse.error;
      concepts.push(...conceptsResponse.data);
      contents.push(...contentsResponse.data);
    }
  }

  return {
    concepts,
    contents,
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

export const getSharedNodePayload = async ({
  client,
  sourceLocalId,
  spaceId,
}: {
  client: DGSupabaseClient;
  sourceLocalId: string;
  spaceId: number;
}): Promise<CrossAppNode> => {
  const [conceptResponse, contentsResponse] = await Promise.all([
    client
      .from("my_concepts")
      .select("author_id, created, last_modified, schema_id, source_local_id")
      .eq("space_id", spaceId)
      .eq("source_local_id", sourceLocalId)
      .eq("is_schema", false)
      .maybeSingle(),
    client
      .from("my_contents")
      .select("author_id, content_type, created, last_modified, text, variant")
      .eq("space_id", spaceId)
      .eq("source_local_id", sourceLocalId)
      .in("variant", ["direct", "full"]),
  ]);
  if (conceptResponse.error) throw conceptResponse.error;
  if (contentsResponse.error) throw contentsResponse.error;
  if (!conceptResponse.data)
    throw new Error(`Shared node '${sourceLocalId}' is no longer available`);

  return buildSharedNodePayload({
    concept: conceptResponse.data,
    contents: contentsResponse.data,
  });
};
