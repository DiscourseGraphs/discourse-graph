import { namedNode } from "@ldo/rdf-utils";
import { parseRdf } from "@ldo/ldo";
import { toRDF, type JsonLdDocument } from "jsonld";
import {
  ContainerProfileShapeType,
  ContentProfileShapeType,
  NodeSchemaProfileShapeType,
  NodeInstanceProfileShapeType,
  RelationInstanceProfileShapeType,
  RelationDefProfileShapeType,
  AbstractRelationDefProfileShapeType,
} from "./ldo/dgBase.shapeTypes";
import type {
  LocalConceptDataInput,
  LocalContentDataInput,
} from "@repo/database/inputTypes";
import { convert, DOCTYPES } from "~/utils/conversion/convert";
import type {
  ContainerProfile,
  ContentProfile,
  NodeSchemaProfile,
  NodeInstanceProfile,
  RelationInstanceProfile,
  RelationDefProfile,
  AbstractRelationDefProfile,
} from "./ldo/dgBase.typings";
import { KnownSchemaIris, KnownSchemaEntities, curieToIri } from "./jsonld";
import { DGSupabaseClient } from "@repo/database/lib/client";
import { Json } from "@repo/database/dbTypes";

const apiRoot = process.env.NEXT_API_ROOT;
const nodeOrSpaceIdRegex = RegExp(`^${apiRoot}/data/\d+(/\d+)?$`);

type NodeParseResult =
  | NodeSchemaProfile
  | NodeInstanceProfile
  | RelationInstanceProfile
  | RelationDefProfile
  | AbstractRelationDefProfile;

type ParseResult = NodeParseResult | ContainerProfile | ContentProfile;

const typePredicate = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const nodeSchemaType = "https://discoursegraphs.com/schema/dg_base#NodeSchema";
const relationDefType =
  "https://discoursegraphs.com/schema/dg_base#RelationDef";
const abstractRelationDefType =
  "https://discoursegraphs.com/schema/dg_base#AbstractRelationDef";
const domainPredicate = "http://www.w3.org/1999/02/22-rdf-syntax-ns#domain";
const sourcePredicate = "https://discoursegraphs.com/schema/dg_base#source";
const contentPredicate = "http://rdfs.org/sioc/ns#content";
const descriptionPredicate = "http://purl.org/dc/elements/1.1/description";
const containerType = "http://rdfs.org/sioc/ns#Container";

export const parseJsonLdAsLdo = async (
  data: JsonLdDocument,
  baseIRI: string,
): Promise<ParseResult[]> => {
  const asQuads = (await toRDF(data, {
    format: "application/n-quads",
  })) as string;
  const ldoDataset = await parseRdf(asQuads, {
    baseIRI,
  });
  const subjects = new Set(ldoDataset.toArray().map((q) => q.subject.value));
  const result: ParseResult[] = [];
  const typeMap: Record<string, string[]> = {};
  for (const q of ldoDataset.match(null, namedNode(typePredicate)).toArray()) {
    const s = q.subject.value;
    if (typeMap[s]) typeMap[s].push(q.object.value);
    else typeMap[s] = [q.object.value];
  }
  for (const subject of subjects) {
    const types = new Set(typeMap[subject]);
    if (types.has(containerType)) {
      result.push(
        ldoDataset.usingType(ContainerProfileShapeType).fromSubject(subject),
      );
      continue;
    }
    if (types.has(nodeSchemaType)) {
      result.push(
        ldoDataset.usingType(NodeSchemaProfileShapeType).fromSubject(subject),
      );
      continue;
    }
    if (types.has(abstractRelationDefType) || types.has(relationDefType)) {
      if (ldoDataset.match(namedNode(subject), namedNode(domainPredicate)).size)
        result.push(
          ldoDataset
            .usingType(RelationDefProfileShapeType)
            .fromSubject(subject),
        );
      else
        result.push(
          ldoDataset
            .usingType(AbstractRelationDefProfileShapeType)
            .fromSubject(subject),
        );
      continue;
    }
    if (
      ldoDataset.match(namedNode(subject), namedNode(contentPredicate)).size
    ) {
      result.push(
        ldoDataset.usingType(ContentProfileShapeType).fromSubject(subject),
      );
      continue;
    }
    // happy path: The types are there
    const typesOfTypes = new Set(
      (typeMap[subject] || []).map((t) => typeMap[t] || []).flat(),
    );
    if (
      typesOfTypes.has(abstractRelationDefType) ||
      typesOfTypes.has(relationDefType)
    ) {
      result.push(
        ldoDataset
          .usingType(RelationInstanceProfileShapeType)
          .fromSubject(subject),
      );
      continue;
    }
    if (typesOfTypes.has(nodeSchemaType)) {
      result.push(
        ldoDataset.usingType(NodeInstanceProfileShapeType).fromSubject(subject),
      );
      continue;
    }
    // otherwise use heuristics
    if (ldoDataset.match(namedNode(subject), namedNode(sourcePredicate)).size) {
      result.push(
        ldoDataset
          .usingType(RelationInstanceProfileShapeType)
          .fromSubject(subject),
      );
      continue;
    }
    if (
      ldoDataset.match(namedNode(subject), namedNode(descriptionPredicate)).size
    ) {
      result.push(
        ldoDataset.usingType(NodeInstanceProfileShapeType).fromSubject(subject),
      );
      continue;
    }
    console.error("Could not interpret ", subject);
  }
  return result;
};

const interpretId = <DBN extends string, LVN extends string>(
  id: string,
  dbVarName: DBN,
  localVarName: LVN,
  knownClasses?: Record<string, string | string[]>,
): Record<DBN, number> | Record<LVN, string> => {
  if (knownClasses && knownClasses[id] !== undefined)
    return { [localVarName]: knownClasses[id] } as Record<LVN, string>;
  if (nodeOrSpaceIdRegex.test(id)) {
    const parts = id.split("/");
    return { [dbVarName]: Number.parseInt(parts[parts.length - 1]!) } as Record<
      DBN,
      number
    >;
  }
  return { [localVarName]: id } as Record<LVN, string>;
};

const baseInterpretId = (id: string) =>
  interpretId(id, "id", "source_local_id");

const parseBaseData = (data: NodeParseResult) => {
  const spaceInfo = data.hasContainer
    ? interpretId(data.hasContainer["@id"], "space_id", "space_local_id")
    : {};
  return {
    created: data.date,
    modified: data.modified,
    author_local_id: data.creator,
    ...spaceInfo,
  };
};

const expectedSchemaIris = new Set<string>(KnownSchemaIris);

const maybeAddKnownClass = (
  ids: string[],
  name: string,
  source_local_id: string,
  knownClasses: Record<string, string | string[]>,
): void => {
  for (const id of ids) {
    if (expectedSchemaIris.has(id)) {
      if (knownClasses[id] === undefined) {
        knownClasses[id] = source_local_id;
        return;
      } else if (knownClasses[id] !== source_local_id) {
        console.error("Conflict on class", id);
        return;
      }
    }
  }
  // hackish
  if (KnownSchemaEntities[name] === undefined) return;
  for (const id of KnownSchemaEntities[name]) {
    if (knownClasses[id] === undefined) {
      knownClasses[id] = source_local_id;
      return;
    } else if (knownClasses[id] !== source_local_id) {
      console.error("Conflict on class", id);
      return;
    }
  }
};

const parseNodeSchema = (
  data: NodeSchemaProfile,
  knownClasses: Record<string, string | string[]>,
): LocalConceptDataInput | null => {
  if (data["@id"] == null) return null;
  const ids = [data["@id"], ...(data.subClassOf || []).map((x) => x["@id"])];
  maybeAddKnownClass(ids, data.label, data["@id"], knownClasses);
  return {
    name: data.label,
    is_schema: true,
    ...baseInterpretId(data["@id"]),
    ...parseBaseData(data),
  };
};

const parseContent = (
  content: ContentProfile,
  data: NodeInstanceProfile,
): LocalContentDataInput | null => {
  if (data["@id"] == null) return null;
  const sourceFormat = DOCTYPES[content.format || ""] ?? "html";
  const text = convert(content.content, sourceFormat, "obsidian");
  return {
    text,
    scale: "document",
    ...baseInterpretId(data["@id"]),
    ...parseBaseData(data),
  };
};

const parseNodeInstance = (
  data: NodeInstanceProfile,
  content: ContentProfile,
  knownClasses: Record<string, string | string[]>,
): LocalConceptDataInput | null => {
  if (data["@id"] == null) return null;
  const schemaInfo = data.type.map((x) =>
    interpretId(x["@id"], "schema_id", "schema_local_id", knownClasses),
  );
  if (!schemaInfo.length) return null;
  // TODO If there's many types, how to choose?
  return {
    name: data.title,
    contents_inline: [parseContent(content, data)].filter((c) => c !== null),
    ...schemaInfo[0],
    ...baseInterpretId(data["@id"]),
    ...parseBaseData(data),
  };
};
const parseAbstractRelationDef = (
  data: AbstractRelationDefProfile,
  knownClasses: Record<string, string | string[]>,
): LocalConceptDataInput | null => {
  if (data["@id"] == null) return null;
  const ids = [data["@id"], ...(data.subClassOf || []).map((x) => x["@id"])];
  maybeAddKnownClass(ids, data.label, data["@id"], knownClasses);
  return {
    name: data.label,
    is_schema: true,
    literal_content: { roles: ["source", "destination"] },
    ...baseInterpretId(data["@id"]),
    ...parseBaseData(data),
  };
};
const parseRelationDef = (
  data: RelationDefProfile,
  knownClasses: Record<string, string | string[]>,
): LocalConceptDataInput | null => {
  if (data["@id"] == null) return null;
  if (data.label) {
    const ids = [data["@id"], ...(data.subClassOf || []).map((x) => x["@id"])];
    maybeAddKnownClass(ids, data.label, data["@id"], knownClasses);
  }
  const source_ids = knownClasses[data.domain["@id"]];
  const destination_ids = knownClasses[data.range["@id"]];
  const source_id = Array.isArray(source_ids) ? source_ids[0] : source_ids;
  const destination_id = Array.isArray(destination_ids)
    ? destination_ids[0]
    : destination_ids;
  if (source_id === undefined || destination_id === undefined) return null;
  // TODO: Find the relation_type if appropriate
  return {
    local_reference_content: { source: source_id, destination: destination_id },
    is_schema: true,
    name: data.label,
    ...baseInterpretId(data["@id"]),
    ...parseBaseData(data),
  };
};

const parseRelationInstance = (
  data: RelationInstanceProfile,
  knownClasses: Record<string, string | string[]>,
): LocalConceptDataInput | null => {
  if (data["@id"] == null) return null;
  const schemaInfo = data.type.map((x) =>
    interpretId(x["@id"], "schema_id", "schema_local_id", knownClasses),
  );
  if (!schemaInfo.length) return null;
  // TODO If there's many types, how to choose?
  return {
    ...schemaInfo[0],
    ...interpretId(data["@id"], "id", "source_local_id"),
    ...parseBaseData(data),
  };
};

const parseLdoNode = (
  data: NodeParseResult,
  contentById: Record<string, ContentProfile>,
  knownClasses: Record<string, string | string[]>,
): LocalConceptDataInput | null => {
  if (!data["@id"]) {
    console.error("No @id: ", data);
    return null;
  }
  const types = new Set(data.type.map((x) => x["@id"]));
  if (types.size === 0) return null;
  if (types.has("RelationInstance"))
    return parseRelationInstance(data as RelationInstanceProfile, knownClasses);
  if (types.has("NodeInstance")) {
    const nodeInstance = data as NodeInstanceProfile;
    if (!nodeInstance.description) return null;
    const content = nodeInstance.description.content
      ? nodeInstance.description
      : contentById[nodeInstance.description["@id"]!];
    if (!content) return null;
    return parseNodeInstance(nodeInstance, content, knownClasses);
  }
  if (types.has("RelationDef"))
    return parseRelationDef(data as RelationDefProfile, knownClasses);
  if (types.has("AbstractRelationDef"))
    return parseAbstractRelationDef(
      data as AbstractRelationDefProfile,
      knownClasses,
    );
  if (types.has("NodeSchema"))
    return parseNodeSchema(data as NodeSchemaProfile, knownClasses);
  console.error("We should not get here");
  return null;
};

const nodeOrder = [
  "NodeSchema",
  "AbstractRelationDef",
  "RelationDef",
  "NodeInstance",
  "RelationInstance",
];

export const parseJsonLdAsDataInputWithSchemas = async (
  data: JsonLdDocument,
  baseIRI: string,
  knownClasses: Record<string, string | string[]>,
): Promise<LocalConceptDataInput[]> => {
  const ldoData = await parseJsonLdAsLdo(data, baseIRI);
  const contents = ldoData.filter((d) =>
    d.type
      .toArray()
      .map((x) => x["@id"])
      .includes("Content"),
  ) as ContentProfile[];
  // assume single content for now
  const contentById = Object.fromEntries(
    contents.map((c) => [c["@id"], c]),
  ) as Record<string, ContentProfile>;
  const nodesWithoutContents = ldoData.filter(
    (d) => contentById[d["@id"] || ""] === undefined,
  ) as NodeParseResult[];
  // Reorder, put schemas first, relations last.
  nodesWithoutContents.sort((n1, n2) => {
    const t1os = n1.type
      .map((x) => nodeOrder.indexOf(x["@id"]))
      .filter((o) => o >= 0);
    const t2os = n1.type
      .map((x) => nodeOrder.indexOf(x["@id"]))
      .filter((o) => o >= 0);
    if (t1os.length === 0) return 1;
    if (t2os.length === 0) return -1;
    if (t2os[0]! < t1os[0]!) return 1;
    if (t1os[0]! < t2os[0]!) return -1;
    // arbitrary order
    if (n1["@id"] === undefined) return 1;
    if (n2["@id"] === undefined) return 1;
    if (n2["@id"] < n1["@id"]) return 1;
    if (n2["@id"] > n1["@id"]) return -1;
    return 0;
  });
  return nodesWithoutContents
    .map((d) => parseLdoNode(d, contentById, knownClasses))
    .filter((x) => !!x);
};

export const parseJsonLdAsInput = async (
  supabase: DGSupabaseClient,
  jsonLdData: JsonLdDocument,
  spaceId: number,
): Promise<LocalConceptDataInput[]> => {
  const baseIri = `${apiRoot}/data/${spaceId}`;
  const { error, data } = await supabase
    .from("Concept")
    .select("name,source_local_id")
    .eq("space_id", spaceId)
    .eq("is_schema", true);
  if (error) throw error;
  const knownClasses = Object.fromEntries(
    data
      .filter(({ name, source_local_id }) => source_local_id !== null)
      .map(({ name, source_local_id }) =>
        (KnownSchemaEntities[name] || []).map((c) => [
          curieToIri(c),
          source_local_id!,
        ]),
      )
      .flat(),
  );
  return await parseJsonLdAsDataInputWithSchemas(
    jsonLdData,
    baseIri,
    knownClasses,
  );
};

export const populate = async (
  supabase: DGSupabaseClient,
  jsonLdData: JsonLdDocument,
  spaceId: number,
): Promise<number[]> => {
  const upsertData = await parseJsonLdAsInput(supabase, jsonLdData, spaceId);
  if (upsertData.length === 0) return [];
  const { data: upsertResult, error: upsertError } = await supabase.rpc(
    "upsert_concepts",
    {
      data: upsertData as Json,
      v_space_id: spaceId,
    },
  );
  if (upsertError) throw upsertError;
  return upsertResult;
};
