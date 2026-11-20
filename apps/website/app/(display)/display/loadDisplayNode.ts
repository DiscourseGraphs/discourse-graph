import { cache } from "react";
import { requestOrigin } from "~/(display)/display/requestOrigin";
import {
  fetchConceptsByIds,
  fetchInstances,
} from "~/(display)/display/spaceQueries";
import type { PostgrestMaybeSingleResponse } from "@supabase/supabase-js";
import type { Json, Tables } from "@repo/database/dbTypes";
import type { ColumnRow } from "@repo/database/inputTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { createClient } from "~/utils/supabase/server";
import { toWebViewHtml, type DocType } from "~/utils/conversion/convert";
import { asJsonLD, schemaLabel } from "~/utils/conversion/jsonld";
import {
  fetchNodeTitles,
  findNode,
  loadConceptAddresses,
  type ConceptAddresses,
} from "~/utils/conversion/nodeLookup";
import {
  nodeContentUrl,
  nodeDataUrl,
  nodeDisplayPath,
  spaceDataUrl,
  spaceDisplayPath,
  type NodePath,
} from "~/utils/conversion/nodeAddress";
import { sanitizeHtml } from "~/utils/conversion/sanitizeHtml";

type Concept = ColumnRow<"Concept">;
type PlatformAccount = Tables<"PlatformAccount">;

export type LinkedNode = {
  title: string;
  typeLabel?: string;
  href?: string;
  // Set only when the node lives in another space than the page's.
  otherSpace?: { name: string; platform: string; href: string };
};

export type RelatedNode = LinkedNode & {
  // The relation's own page.
  relationHref?: string;
};

export type RelationGroup = {
  label: string;
  nodes: RelatedNode[];
};

export type RelationInstance = {
  href?: string;
  source?: LinkedNode;
  destination?: LinkedNode;
};

export type DisplayKind = "node" | "relation" | "nodeType" | "relationType";

export type DisplayNode = {
  kind: DisplayKind;
  title: string;
  typeLabel?: string;
  typeHref?: string;
  bodyHtml?: string;
  authorName?: string;
  created: string;
  modified: string;
  rid?: string;
  spaceName: string;
  spaceHref: string;
  dataUrl: string;
  bodyUrl: string;
  relationGroups: RelationGroup[];
  // For a relation shown on its own: what it links.
  endpoints?: { label: string; source?: LinkedNode; destination?: LinkedNode };
  // For a relation type: the label read in the other direction.
  complement?: string;
  // For a node type: its visible nodes.
  instances?: LinkedNode[];
  // For a relation type: its visible relations.
  relationInstances?: RelationInstance[];
  jsonLd: Record<string, Json>;
};

const asObject = (value: Json | null): Record<string, Json> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : {};

const relationLabels = (
  relationType: Concept | undefined,
): { label: string; complement: string } => {
  const literal = asObject(relationType?.literal_content ?? null);
  const label =
    typeof literal.label === "string"
      ? literal.label
      : (relationType?.name ?? "related to");
  const complement =
    typeof literal.complement === "string"
      ? literal.complement
      : `${label} (reverse)`;
  return { label, complement };
};

const roleTarget = (relation: Concept, role: string): number | undefined => {
  const value = asObject(relation.reference_content ?? null)[role];
  return typeof value === "number" ? value : undefined;
};

const displayKind = (concept: Concept): DisplayKind => {
  if (concept.is_schema)
    return concept.is_relation ? "relationType" : "nodeType";
  return concept.is_relation ? "relation" : "node";
};

const fetchRelations = async (
  supabase: DGSupabaseClient,
  concept: Concept,
): Promise<Concept[]> => {
  if (concept.is_schema) return [];
  const response = (await supabase
    .from("Concept")
    .select("relations:concept_in_relations!inner(*)")
    .eq("id", concept.id)
    .maybeSingle()) as PostgrestMaybeSingleResponse<{ relations: Concept[] }>;
  if (response.error) throw new Error(response.error.message);
  return (response.data?.relations ?? []).filter((r) => !r.is_schema);
};

const fetchAuthor = async (
  supabase: DGSupabaseClient,
  authorId: number | null,
): Promise<PlatformAccount | undefined> => {
  if (!authorId) return undefined;
  const response = await supabase
    .from("PlatformAccount")
    .select()
    .eq("id", authorId)
    .maybeSingle();
  // Anonymous readers may not see accounts; the page is shown without them.
  return response.data ?? undefined;
};

const linkedNode = ({
  conceptId,
  homeSpaceId,
  concepts,
  titles,
  addresses,
}: {
  conceptId: number;
  homeSpaceId: number;
  concepts: Record<number, Concept>;
  titles: Map<number, string>;
  addresses: ConceptAddresses;
}): LinkedNode | undefined => {
  const concept = concepts[conceptId];
  if (!concept) return undefined;
  const schema = concept.schema_id ? concepts[concept.schema_id] : undefined;
  const nodePath = addresses.pathOf(conceptId);
  return {
    title: concept.is_schema
      ? schemaLabel(concept)
      : (titles.get(conceptId) ?? concept.name),
    typeLabel: schema && schemaLabel(schema),
    href: nodePath && nodeDisplayPath(nodePath),
    otherSpace:
      nodePath && concept.space_id !== homeSpaceId
        ? {
            name: addresses.spaceNameOf(conceptId) ?? nodePath.spaceKey,
            platform: nodePath.platform,
            href: spaceDisplayPath(nodePath),
          }
        : undefined,
  };
};

const groupRelations = ({
  concept,
  relations,
  concepts,
  titles,
  addresses,
}: {
  concept: Concept;
  relations: Concept[];
  concepts: Record<number, Concept>;
  titles: Map<number, string>;
  addresses: ConceptAddresses;
}): RelationGroup[] => {
  const groups = new Map<string, RelatedNode[]>();
  for (const relation of relations) {
    const relationType = relation.schema_id
      ? concepts[relation.schema_id]
      : undefined;
    const { label, complement } = relationLabels(relationType);
    const isSource = roleTarget(relation, "source") === concept.id;
    const otherId = roleTarget(relation, isSource ? "destination" : "source");
    if (otherId === undefined) continue;
    const other = linkedNode({
      conceptId: otherId,
      homeSpaceId: concept.space_id,
      concepts,
      titles,
      addresses,
    });
    if (!other) continue;
    const groupLabel = isSource ? label : complement;
    const relationPath = addresses.pathOf(relation.id);
    const related: RelatedNode = {
      ...other,
      relationHref: relationPath && nodeDisplayPath(relationPath),
    };
    groups.set(groupLabel, [...(groups.get(groupLabel) ?? []), related]);
  }
  return [...groups.entries()]
    .map(([label, nodes]) => ({ label, nodes }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

// What a relation links, or which node types a relation type links.
// Undefined when neither end is set or visible.
const relationEndpoints = ({
  concept,
  homeSpaceId,
  label,
  concepts,
  titles,
  addresses,
}: {
  concept: Concept;
  homeSpaceId: number;
  label: string;
  concepts: Record<number, Concept>;
  titles: Map<number, string>;
  addresses: ConceptAddresses;
}): DisplayNode["endpoints"] => {
  if (!concept.is_relation) return undefined;
  const endOf = (role: string): LinkedNode | undefined => {
    const conceptId = roleTarget(concept, role);
    return conceptId === undefined
      ? undefined
      : linkedNode({
          conceptId,
          homeSpaceId,
          concepts,
          titles,
          addresses,
        });
  };
  const source = endOf("source");
  const destination = endOf("destination");
  if (!source && !destination) return undefined;
  return { label, source, destination };
};

// Returns undefined when the node does not exist or the reader cannot see it.
export const loadDisplayNode = cache(
  async (nodePath: NodePath): Promise<DisplayNode | undefined> => {
    const supabase = await createClient();
    const found = await findNode({ supabase, nodePath });
    if ("failure" in found) return undefined;
    const { space, concept, contents } = found;
    const origin = await requestOrigin();

    const [relations, instances] = await Promise.all([
      fetchRelations(supabase, concept),
      concept.is_schema
        ? fetchInstances(supabase, concept.id)
        : Promise.resolve([]),
    ]);
    const endpointIds = [
      ...new Set(
        [concept, ...relations, ...instances]
          .flatMap((c) => c.refs)
          .filter((id) => id !== concept.id),
      ),
    ];
    const endpoints = await fetchConceptsByIds(supabase, endpointIds);
    const schemaIds = [
      ...new Set(
        [concept, ...relations, ...Object.values(endpoints)]
          .map((c) => c.schema_id)
          .filter((id): id is number => id !== null),
      ),
    ];
    const concepts: Record<number, Concept> = {
      ...endpoints,
      ...Object.fromEntries(instances.map((c) => [c.id, c])),
      ...(await fetchConceptsByIds(supabase, schemaIds)),
      [concept.id]: concept,
    };
    const [author, addresses, titles] = await Promise.all([
      fetchAuthor(supabase, concept.author_id),
      loadConceptAddresses({
        supabase,
        origin,
        concepts: [concept, ...relations, ...Object.values(concepts)],
      }),
      fetchNodeTitles({
        supabase,
        concepts: [...Object.values(endpoints), ...instances],
      }),
    ]);
    if ("failure" in addresses)
      throw new Error(addresses.failure.error?.message);

    const schema = concept.schema_id ? concepts[concept.schema_id] : undefined;
    const title = contents.find((c) => c.variant === "direct");
    const fullContents = contents.find((c) => c.variant === "full");
    const source: DocType = space.platform === "Obsidian" ? "obsidian" : "roam";
    const schemaPath = concept.schema_id
      ? addresses.pathOf(concept.schema_id)
      : undefined;
    const kind = displayKind(concept);
    const { label, complement } = relationLabels(
      kind === "relation" ? schema : concept,
    );
    const relationEnds = relationEndpoints({
      concept,
      homeSpaceId: concept.space_id,
      label,
      concepts,
      titles,
      addresses,
    });

    return {
      kind,
      title:
        kind === "relation" && relationEnds
          ? [relationEnds.source?.title, label, relationEnds.destination?.title]
              .filter((part) => part !== undefined)
              .join(" · ")
          : concept.is_schema
            ? schemaLabel(concept)
            : (title?.text ?? concept.name),
      typeLabel: schema && schemaLabel(schema),
      typeHref: schemaPath && nodeDisplayPath(schemaPath),
      bodyHtml: fullContents
        ? sanitizeHtml(toWebViewHtml({ text: fullContents.text, source }))
        : undefined,
      authorName: author?.name ?? undefined,
      created: concept.created,
      modified: concept.last_modified,
      rid: addresses.ridOf(concept.id),
      spaceName: space.name,
      spaceHref: spaceDisplayPath(nodePath),
      dataUrl: nodeDataUrl({ origin, nodePath }),
      bodyUrl: nodeContentUrl({ origin, nodePath }),
      relationGroups: groupRelations({
        concept,
        relations,
        concepts,
        titles,
        addresses,
      }),
      endpoints: relationEnds,
      complement: kind === "relationType" ? complement : undefined,
      instances:
        kind === "nodeType"
          ? instances
              .map((c) =>
                linkedNode({
                  conceptId: c.id,
                  homeSpaceId: concept.space_id,
                  concepts,
                  titles,
                  addresses,
                }),
              )
              .filter((n): n is LinkedNode => n !== undefined)
              // The page is the type, so each node's type badge is redundant.
              .map((n) => ({ ...n, typeLabel: undefined }))
              .sort((a, b) => a.title.localeCompare(b.title))
          : undefined,
      relationInstances:
        kind === "relationType"
          ? instances.map((relation) => {
              const ends = relationEndpoints({
                concept: relation,
                homeSpaceId: concept.space_id,
                label,
                concepts,
                titles,
                addresses,
              });
              const relationPath = addresses.pathOf(relation.id);
              return {
                href: relationPath && nodeDisplayPath(relationPath),
                source: ends?.source,
                destination: ends?.destination,
              };
            })
          : undefined,
      jsonLd: asJsonLD({
        platform: space.platform,
        concept,
        addresses,
        ownSpaceUrl: spaceDataUrl({ origin, ...nodePath }),
        title,
        schema,
        author,
        wrap: true,
      }),
    };
  },
);
