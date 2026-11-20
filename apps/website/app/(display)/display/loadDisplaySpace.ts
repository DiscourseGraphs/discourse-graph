import { cache } from "react";
import { requestOrigin } from "~/(display)/display/requestOrigin";
import {
  fetchAllPages,
  fetchSpaceTitles,
} from "~/(display)/display/spaceQueries";
import type { Json } from "@repo/database/dbTypes";
import type { ColumnRow } from "@repo/database/inputTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { createClient } from "~/utils/supabase/server";
import { schemaLabel } from "~/utils/conversion/jsonld";
import { findSpace } from "~/utils/conversion/nodeLookup";
import {
  nodeDisplayPath,
  spaceDataUrl,
  type NodePath,
} from "~/utils/conversion/nodeAddress";

type Concept = ColumnRow<"Concept">;
type SpacePath = Omit<NodePath, "localId">;

export type SpaceEntry = { title: string; href: string };

export type NodeTypeSection = { label: string; nodes: SpaceEntry[] };

export type DisplaySpace = {
  name: string;
  platform: string;
  url: string;
  dataUrl: string;
  nodeSections: NodeTypeSection[];
  nodeTypes: SpaceEntry[];
  relationTypes: SpaceEntry[];
  relationCount: number;
  jsonLd: Record<string, Json>;
};

const fetchSpaceConcepts = (
  supabase: DGSupabaseClient,
  spaceId: number,
): Promise<Concept[]> =>
  fetchAllPages((start, end) =>
    supabase
      .from("Concept")
      .select()
      .eq("space_id", spaceId)
      .order("id")
      .range(start, end),
  );

const byTitle = (a: SpaceEntry, b: SpaceEntry): number =>
  a.title.localeCompare(b.title);

// Lists what the reader can see in a space. Returns undefined when the space
// does not exist or the reader cannot see it.
export const loadDisplaySpace = cache(
  async (spacePath: SpacePath): Promise<DisplaySpace | undefined> => {
    const supabase = await createClient();
    const spaceResult = await findSpace({ supabase, ...spacePath });
    if ("failure" in spaceResult) return undefined;
    const { space } = spaceResult;
    const [concepts, titles] = await Promise.all([
      fetchSpaceConcepts(supabase, space.id),
      fetchSpaceTitles(supabase, space.id),
    ]);
    const entryOf = (concept: Concept): SpaceEntry | undefined =>
      concept.source_local_id
        ? {
            title: concept.is_schema
              ? schemaLabel(concept)
              : (titles.get(concept.source_local_id) ?? concept.name),
            href: nodeDisplayPath({
              ...spacePath,
              localId: concept.source_local_id,
            }),
          }
        : undefined;

    const schemas = new Map(
      concepts.filter((c) => c.is_schema).map((c) => [c.id, c]),
    );
    const sections = new Map<string, SpaceEntry[]>();
    for (const concept of concepts) {
      if (concept.is_schema || concept.is_relation) continue;
      const entry = entryOf(concept);
      if (!entry) continue;
      const schema = concept.schema_id
        ? schemas.get(concept.schema_id)
        : undefined;
      const label = schema ? schemaLabel(schema) : "Other";
      sections.set(label, [...(sections.get(label) ?? []), entry]);
    }
    const typeEntries = (isRelation: boolean): SpaceEntry[] =>
      [...schemas.values()]
        .filter((c) => c.is_relation === isRelation)
        .map(entryOf)
        .filter((e): e is SpaceEntry => e !== undefined)
        .sort(byTitle);

    const dataUrl = spaceDataUrl({
      origin: await requestOrigin(),
      ...spacePath,
    });
    return {
      name: space.name,
      platform: space.platform,
      url: space.url,
      dataUrl,
      nodeSections: [...sections.entries()]
        .map(([label, nodes]) => ({ label, nodes: nodes.sort(byTitle) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      nodeTypes: typeEntries(false),
      relationTypes: typeEntries(true),
      relationCount: concepts.filter((c) => c.is_relation && !c.is_schema)
        .length,
      jsonLd: {
        "@context": `${new URL(dataUrl).origin}/schema/context.jsonld`,
        "@id": dataUrl,
        "@type": "Container",
        label: space.name,
        sameAs: space.url,
      },
    };
  },
);
