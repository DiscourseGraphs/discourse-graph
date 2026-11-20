import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Tables } from "@repo/database/dbTypes";
import type { ColumnRow } from "@repo/database/inputTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  nodeIri,
  platformFromSegment,
  ridFromNodePath,
  spaceKeyFromSpaceUrl,
  spaceUrlFromSpaceKey,
  type NodePath,
} from "~/utils/conversion/nodeAddress";

type Space = Tables<"Space">;
type Concept = ColumnRow<"Concept">;
type Content = Tables<"Content">;

type Failure = { failure: PostgrestSingleResponse<never> };

export type FoundSpace = { space: Space; spaceKey: string };

export type FoundNode = FoundSpace & {
  nodePath: NodePath;
  concept: Concept;
  contents: Content[];
};

// The public identifiers of concepts that JSON-LD output names, keyed by
// `Concept.id`. A concept the reader cannot see has no entry.
export type ConceptAddresses = {
  iriOf: (conceptId: number) => string | undefined;
  ridOf: (conceptId: number) => string | undefined;
  pathOf: (conceptId: number) => NodePath | undefined;
  spaceNameOf: (conceptId: number) => string | undefined;
};

// `.in()` filters go in the GET URL, which caps the ids per request.
const ID_BATCH_SIZE = 200;

const referencedConceptIds = (concepts: Concept[]): number[] => [
  ...new Set(
    concepts.flatMap((c) => [
      c.id,
      ...(c.schema_id === null ? [] : [c.schema_id]),
      ...c.refs,
    ]),
  ),
];

export const loadConceptAddresses = async ({
  supabase,
  origin,
  concepts,
}: {
  supabase: DGSupabaseClient;
  origin: string;
  concepts: Concept[];
}): Promise<ConceptAddresses | Failure> => {
  const ids = referencedConceptIds(concepts);
  const addressRows: {
    id: number;
    space_id: number;
    source_local_id: string | null;
    is_schema: boolean;
  }[] = [];
  for (let start = 0; start < ids.length; start += ID_BATCH_SIZE) {
    const conceptResponse = await supabase
      .from("Concept")
      .select("id, space_id, source_local_id, is_schema")
      .in("id", ids.slice(start, start + ID_BATCH_SIZE));
    if (conceptResponse.error)
      return {
        failure: asPostgrestFailure(
          conceptResponse.error.message,
          conceptResponse.error.code,
          conceptResponse.status,
        ),
      };
    addressRows.push(...conceptResponse.data);
  }
  const spaceIds = [...new Set(addressRows.map((c) => c.space_id))];
  const spaceResponse = await supabase
    .from("Space")
    .select("id, platform, url, name")
    .in("id", spaceIds);
  if (spaceResponse.error)
    return {
      failure: asPostgrestFailure(
        spaceResponse.error.message,
        spaceResponse.error.code,
        spaceResponse.status,
      ),
    };
  const spacesById = new Map(spaceResponse.data.map((s) => [s.id, s]));
  const addressed = new Map<
    number,
    { nodePath: NodePath; isSchema: boolean; spaceName: string }
  >();
  for (const concept of addressRows) {
    const space = spacesById.get(concept.space_id);
    if (!space || !concept.source_local_id) continue;
    const spaceKey = spaceKeyFromSpaceUrl({
      platform: space.platform,
      spaceUrl: space.url,
    });
    if (!spaceKey) continue;
    addressed.set(concept.id, {
      nodePath: {
        platform: space.platform,
        spaceKey,
        localId: concept.source_local_id,
      },
      isSchema: concept.is_schema,
      spaceName: space.name,
    });
  }
  return {
    iriOf: (conceptId) => {
      const entry = addressed.get(conceptId);
      return entry && nodeIri({ origin, nodePath: entry.nodePath });
    },
    ridOf: (conceptId) => {
      const entry = addressed.get(conceptId);
      return entry && ridFromNodePath(entry);
    },
    pathOf: (conceptId) => addressed.get(conceptId)?.nodePath,
    spaceNameOf: (conceptId) => addressed.get(conceptId)?.spaceName,
  };
};

export const nodePathFromSegments = ({
  platform,
  spaceKey,
  localId,
}: {
  platform?: string;
  spaceKey?: string;
  localId?: string;
}): NodePath | Failure => {
  const knownPlatform = platformFromSegment(platform ?? "");
  if (!knownPlatform)
    return {
      failure: asPostgrestFailure(`Unknown platform ${platform}`, "404", 404),
    };
  if (!spaceKey || !localId)
    return { failure: asPostgrestFailure("Incomplete address", "404", 404) };
  return { platform: knownPlatform, spaceKey, localId };
};

const notFound = (what: string): Failure => ({
  failure: asPostgrestFailure(`${what} not found`, "404", 404),
});

// Private resources are invisible under RLS, so they report as not found.
export const findSpace = async ({
  supabase,
  platform,
  spaceKey,
}: {
  supabase: DGSupabaseClient;
  platform: NodePath["platform"];
  spaceKey: string;
}): Promise<FoundSpace | Failure> => {
  const response = await supabase
    .from("Space")
    .select()
    .eq("platform", platform)
    .eq("url", spaceUrlFromSpaceKey({ platform, spaceKey }))
    .maybeSingle();
  if (response.error)
    return {
      failure: asPostgrestFailure(
        response.error.message,
        response.error.code,
        response.status,
      ),
    };
  if (!response.data) return notFound("Space");
  return { space: response.data, spaceKey };
};

export const findNode = async ({
  supabase,
  nodePath,
}: {
  supabase: DGSupabaseClient;
  nodePath: NodePath;
}): Promise<FoundNode | Failure> => {
  const spaceResult = await findSpace({ supabase, ...nodePath });
  if ("failure" in spaceResult) return spaceResult;
  const { space } = spaceResult;
  const [conceptResponse, contentResponse] = await Promise.all([
    supabase
      .from("Concept")
      .select()
      .eq("space_id", space.id)
      .eq("source_local_id", nodePath.localId)
      .maybeSingle(),
    supabase
      .from("Content")
      .select()
      .eq("space_id", space.id)
      .eq("source_local_id", nodePath.localId),
  ]);
  for (const response of [conceptResponse, contentResponse]) {
    if (response.error)
      return {
        failure: asPostgrestFailure(
          response.error.message,
          response.error.code,
          response.status,
        ),
      };
  }
  if (!conceptResponse.data) return notFound("Node");
  return {
    ...spaceResult,
    nodePath,
    concept: conceptResponse.data,
    contents: contentResponse.data ?? [],
  };
};

// `.in()` filters go in the GET URL, which caps the local ids per request.
const TITLE_BATCH_SIZE = 50;

// The stored titles (`direct` content) of nodes, keyed by `Concept.id`.
// `Concept.name` is not a title on every platform: in Obsidian it is the file path.
export const fetchNodeTitles = async ({
  supabase,
  concepts,
}: {
  supabase: DGSupabaseClient;
  concepts: Concept[];
}): Promise<Map<number, string>> => {
  const conceptIdByKey = new Map(
    concepts
      .filter((c) => !c.is_schema && c.source_local_id)
      .map((c) => [`${c.space_id}/${c.source_local_id}`, c.id]),
  );
  const localIds = [
    ...new Set(
      concepts.map((c) => c.source_local_id).filter((id) => id !== null),
    ),
  ];
  const spaceIds = [...new Set(concepts.map((c) => c.space_id))];
  const titles = new Map<number, string>();
  for (let start = 0; start < localIds.length; start += TITLE_BATCH_SIZE) {
    const response = await supabase
      .from("Content")
      .select("space_id, source_local_id, text")
      .eq("variant", "direct")
      .in("space_id", spaceIds)
      .in("source_local_id", localIds.slice(start, start + TITLE_BATCH_SIZE));
    if (response.error) throw new Error(response.error.message);
    for (const content of response.data) {
      const conceptId = conceptIdByKey.get(
        `${content.space_id}/${content.source_local_id}`,
      );
      if (conceptId !== undefined) titles.set(conceptId, content.text);
    }
  }
  return titles;
};
