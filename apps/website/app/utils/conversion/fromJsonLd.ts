import { namedNode } from "@ldo/rdf-utils";
import type { NamedNode, Quad_Object, Literal } from "@rdfjs/types";
import { parseRdf } from "@ldo/ldo";
import type { LdoDataset, ShapeType, LdoBase } from "@ldo/ldo";
import ShexJTraverser from "@ldo/traverser-shexj";
import { type ShapeDecl } from "@ldo/traverser-shexj";
import { toRDF, type JsonLdDocument } from "jsonld";
import {
  ContainerProfileShapeType,
  ContentProfileShapeType,
  NodeSchemaProfileShapeType,
  NodeInstanceProfileShapeType,
  RelationInstanceProfileShapeType,
  RelationDefProfileShapeType,
  AbstractRelationDefProfileShapeType,
  PersonAccountProfileShapeType,
} from "./ldo/dgBase.shapeTypes";
import type {
  LocalAccountDataInput,
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
  PersonAccountProfile,
} from "./ldo/dgBase.typings";
import {
  KnownSchemaIris,
  KnownSchemaEntities,
  KnownRelationEntities,
  curieToIri,
  iriToCurie,
  KnownClassIris,
  KnownRelationIris,
} from "./jsonld";
import { DGSupabaseClient } from "@repo/database/lib/client";
import { Json, Enums, TablesInsert } from "@repo/database/dbTypes";
import { intersection } from "@repo/utils/setOperations";

const apiRoot = process.env.NEXT_API_ROOT;
const nodeOrSpaceIdRegex = RegExp(`^${apiRoot}/data/\d+(/\d+)?$`);
type PlatformType = Enums<"Platform">;
type AccountType = TablesInsert<"PlatformAccount">;

type NodeParseResult =
  | NodeSchemaProfile
  | NodeInstanceProfile
  | RelationInstanceProfile
  | RelationDefProfile
  | AbstractRelationDefProfile;

type ParseResult =
  | NodeParseResult
  | ContainerProfile
  | ContentProfile
  | PersonAccountProfile;

const typePredicate = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const nodeSchemaType = "https://discoursegraphs.com/schema/dg_base#NodeSchema";
const relationDefType =
  "https://discoursegraphs.com/schema/dg_base#RelationDef";
const abstractRelationDefType =
  "https://discoursegraphs.com/schema/dg_base#AbstractRelationDef";

const domainPredicate = "http://www.w3.org/2000/01/rdf-schema#domain";
const sourcePredicate = "https://discoursegraphs.com/schema/dg_base#source";
const contentPredicate = "http://rdfs.org/sioc/ns#content";
const descriptionPredicate = "http://purl.org/dc/terms/description";
const containerType = "http://rdfs.org/sioc/ns#Container";
const restrictionType = "http://www.w3.org/2002/07/owl#Restriction";
const accountType = "http://rdfs.org/sioc/ns#UserAccount";
export const schemaTypeSet = new Set([
  nodeSchemaType,
  relationDefType,
  abstractRelationDefType,
]);

export type SchemaTypes =
  | "https://discoursegraphs.com/schema/dg_base#NodeSchema"
  | "https://discoursegraphs.com/schema/dg_base#RelationDef"
  | "https://discoursegraphs.com/schema/dg_base#AbstractRelationDef";

export const parseJsonLdAsLdoDataset = async (
  data: JsonLdDocument,
  baseIRI: string,
): Promise<LdoDataset> => {
  const asQuads = (await toRDF(data, {
    format: "application/n-quads",
  })) as string;
  // console.log(asQuads);
  return await parseRdf(asQuads, {
    baseIRI,
  });
};

export const extractLdoData = async (
  ldoDataset: LdoDataset,
  knownIris: Record<string, string>,
  knownSchemaTypes: Record<string, SchemaTypes>,
): Promise<ParseResult[]> => {
  const subjects = new Set(ldoDataset.toArray().map((q) => q.subject.value));
  const result: ParseResult[] = [];
  const typeMap: Record<string, string[]> = {};
  for (const q of ldoDataset.match(null, namedNode(typePredicate)).toArray()) {
    const s = q.subject.value;
    if (typeMap[s]) typeMap[s].push(q.object.value);
    else typeMap[s] = [q.object.value];
  }
  for (const subject of subjects) {
    const typesA = typeMap[subject];
    if (!typesA) continue;
    const types = new Set(typesA);
    if (types.has(restrictionType)) continue;
    if (intersection(types, schemaTypeSet).size) {
      typesA.map((t) => {
        if (schemaTypeSet.has(t)) {
          knownSchemaTypes[subject] = t as SchemaTypes;
        }
        if (KnownSchemaIris.has(t) && knownIris[t] === undefined) {
          knownIris[t] = subject;
        }
      });
    }
    if (types.has(accountType)) {
      result.push(
        ldoDataset
          .usingType(PersonAccountProfileShapeType)
          .fromSubject(subject),
      );
      continue;
    }
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
      knownSchemaTypes[subject] = nodeSchemaType;
      continue;
    }
    if (types.has(abstractRelationDefType) || types.has(relationDefType)) {
      if (
        ldoDataset.match(namedNode(subject), namedNode(domainPredicate)).size
      ) {
        result.push(
          ldoDataset
            .usingType(RelationDefProfileShapeType)
            .fromSubject(subject),
        );
        knownSchemaTypes[subject] = relationDefType;
      } else {
        result.push(
          ldoDataset
            .usingType(AbstractRelationDefProfileShapeType)
            .fromSubject(subject),
        );
        knownSchemaTypes[subject] = abstractRelationDefType;
      }
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
    // New we know it's an instance; try to add the underlying schema type
    let schemaType: string | undefined;
    typesA.map((t) => {
      if (knownSchemaTypes[t]) schemaType = knownSchemaTypes[t];
      const v2 = knownIris[t];
      if (v2 && knownSchemaTypes[v2]) schemaType = knownSchemaTypes[v2];
    });
    if (schemaType === nodeSchemaType) {
      result.push(
        ldoDataset.usingType(NodeInstanceProfileShapeType).fromSubject(subject),
      );
      continue;
    } else if (schemaType !== undefined) {
      result.push(
        ldoDataset
          .usingType(RelationInstanceProfileShapeType)
          .fromSubject(subject),
      );
      continue;
    }
    // otherwise use heuristics
    if (intersection(KnownRelationIris, types).size > 0) {
      result.push(
        ldoDataset
          .usingType(RelationInstanceProfileShapeType)
          .fromSubject(subject),
      );
      continue;
    }
    if (intersection(KnownClassIris, types).size > 0) {
      result.push(
        ldoDataset.usingType(NodeInstanceProfileShapeType).fromSubject(subject),
      );
      continue;
    }
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
  // console.log("knownSchemaTypes after:", knownSchemaTypes);
  // console.log("knownIris after:", knownIris);
  return result;
};

const interpretId = <DBN extends string, LVN extends string>(
  id: string,
  dbVarName: DBN,
  localVarName: LVN,
  knownIris?: Record<string, string>,
): Record<DBN, number> | Record<LVN, string> => {
  if (knownIris && knownIris[id] !== undefined)
    return { [localVarName]: knownIris[id] } as Record<LVN, string>;
  if (nodeOrSpaceIdRegex.test(id)) {
    const parts = id.split("/");
    return { [dbVarName]: Number.parseInt(parts[parts.length - 1]!) } as Record<
      DBN,
      number
    >;
  }
  return { [localVarName]: id } as Record<LVN, string>;
};

const KnownShapeIris: Record<string, Set<string>> = {};

type PredicateExtractionVisitorContext = {
  predicates: Set<string>;
};

const predicateExtractionVisitor =
  ShexJTraverser.createVisitor<PredicateExtractionVisitorContext>({
    TripleConstraint: {
      visitor: async (tripleConstraint, instanceNode, context) => {
        context.predicates.add(tripleConstraint.predicate);
      },
    },
  });

const getKnownIris = async (
  shapeDecl: ShapeDecl | undefined,
): Promise<Set<string>> => {
  if (shapeDecl === undefined) return new Set();
  if (KnownShapeIris[shapeDecl.id] === undefined) {
    const context: PredicateExtractionVisitorContext = {
      predicates: new Set(),
    };
    await predicateExtractionVisitor.visit(shapeDecl, "ShapeDecl", context);
    KnownShapeIris[shapeDecl.id] = context.predicates;
  }
  return KnownShapeIris[shapeDecl.id] ?? new Set();
};

const identifyExtraData = async <T extends LdoBase>(
  dataset: LdoDataset,
  id: string,
  shape: ShapeType<T>,
): Promise<{
  literals: Record<string, string | string[]>;
  references: Record<string, string | string[]>;
}> => {
  const shapeDecl = (shape.schema.shapes ?? []).filter(
    (s) => s.id === shape.shape,
  )[0];
  const knownIris = await getKnownIris(shapeDecl);
  const extra: [string, Quad_Object][] = dataset
    .match(namedNode(id))
    .toArray()
    .filter((q) => !knownIris.has(q.predicate.value))
    .map((q) => [q.predicate.value, q.object]);
  const literals: Record<string, string | string[]> = {};
  const references: Record<string, string | string[]> = {};
  for (let [s, o] of extra) {
    s = iriToCurie(s);
    const results =
      o.termType === "Literal"
        ? literals
        : o.termType === "NamedNode"
          ? references
          : null;
    if (results === null) continue;
    const value = o.termType === "NamedNode" ? iriToCurie(o.value) : o.value;
    if (results[s] === undefined) results[s] = value;
    else if (Array.isArray(results[s])) (results[s] as string[]).push(value);
    else results[s] = [results[s] as string, value];
  }
  return { literals, references };
};

const addExtraData = async <T extends LdoBase>(
  dataset: LdoDataset,
  id: string,
  shape: ShapeType<T>,
  concept: LocalConceptDataInput | null,
): Promise<LocalConceptDataInput | null> => {
  if (concept === null) return null;
  const { literals, references } = await identifyExtraData(dataset, id, shape);
  if (Object.keys(literals).length > 0)
    concept.literal_content = {
      extra: literals,
      ...((concept.literal_content as Record<string, Json>) || {}),
    };
  // TODO check which iris are internal refs
  // if (Object.keys(references).length > 0)
  //   concept.reference_content = {
  //     extra: references,
  //     ...((concept.reference_content as Record<string, number | number[]>) ||
  //       {}),
  //   };
  return concept;
};

const baseInterpretId = (id: string) =>
  interpretId(id, "id", "source_local_id");

const parseBaseData = (data: NodeParseResult) => {
  const spaceInfo = data.hasContainer
    ? interpretId(data.hasContainer["@id"], "space_id", "space_local_id")
    : {};
  return {
    created: data.created,
    last_modified: data.modified,
    author_local_id: data.creator["@id"],
    ...spaceInfo,
  };
};

const maybeAddKnownClass = (
  ids: string[],
  name: string | undefined,
  source_local_id: string,
  knownIris: Record<string, string>,
): void => {
  for (const id of ids) {
    if (KnownSchemaIris.has(id)) {
      if (knownIris[id] === undefined) {
        knownIris[id] = source_local_id;
        return;
      } else if (knownIris[id] !== source_local_id) {
        console.error("Conflict 1 on class", id);
        return;
      }
    }
  }
  // hackish
  if (name === undefined || KnownSchemaEntities[name] === undefined) return;
  for (const id of KnownSchemaEntities[name]) {
    const iri = curieToIri(id);
    if (knownIris[iri] === undefined) {
      knownIris[iri] = source_local_id;
      return;
    } else if (knownIris[iri] !== source_local_id) {
      console.error("Conflict 2 on class", id);
      return;
    }
  }
};

const parseNodeSchema = (
  data: NodeSchemaProfile,
  knownIris: Record<string, string>,
): LocalConceptDataInput | null => {
  if (data["@id"] == null) return null;
  const ids = [data["@id"], ...(data.subClassOf || []).map((x) => x["@id"])];
  maybeAddKnownClass(ids, data.label, data["@id"], knownIris);
  return {
    name: data.label,
    is_schema: true,
    ...baseInterpretId(data["@id"]),
    ...parseBaseData(data),
  };
};

const parsePersonDef = (
  person: PersonAccountProfile,
  platform: PlatformType,
): AccountType | null => {
  const account_local_id = person["@id"];
  if (!account_local_id) return null;
  return {
    account_local_id,
    name: person.name,
    platform,
    agent_type: "person",
  };
};

const parseContent = (
  content: ContentProfile,
  data: NodeInstanceProfile,
): LocalContentDataInput | null => {
  const id = content["@id"] ?? data["@id"]; // they can share identity
  if (!id) return null;
  const sourceFormat = DOCTYPES[content.format || ""] ?? "html";
  const text = convert(content.content, sourceFormat, "obsidian");
  return {
    text,
    variant: "full",
    scale: "document",
    ...baseInterpretId(id),
    ...parseBaseData(data),
  };
};

const parseNodeInstance = (
  data: NodeInstanceProfile,
  content: ContentProfile,
  knownIris: Record<string, string>,
): LocalConceptDataInput | null => {
  if (data["@id"] == null) return null;
  const schemaInfo = data.type.map((x) =>
    interpretId(
      x["@id"],
      "schema_id",
      "schema_represented_by_local_id",
      knownIris,
    ),
  );
  if (!schemaInfo.length) return null;
  // TODO If there's many types, how to choose?
  const parsedContent = parseContent(content, data);
  return {
    name: data.title,
    contents_inline: parsedContent ? [parsedContent] : [],
    ...schemaInfo[0],
    ...baseInterpretId(data["@id"]),
    ...parseBaseData(data),
  };
};
const parseAbstractRelationDef = (
  data: AbstractRelationDefProfile,
  knownIris: Record<string, string>,
): LocalConceptDataInput | null => {
  if (data["@id"] == null) return null;
  const ids = [data["@id"], ...(data.subClassOf || []).map((x) => x["@id"])];
  maybeAddKnownClass(ids, data.label, data["@id"], knownIris);
  return {
    name: data.label,
    is_schema: true,
    literal_content: { roles: ["source", "destination"], label: data.label },
    ...baseInterpretId(data["@id"]),
    ...parseBaseData(data),
  };
};
const parseRelationDef = (
  data: RelationDefProfile,
  knownIris: Record<string, string>,
): LocalConceptDataInput | null => {
  if (data["@id"] == null) return null;
  let relationType: string | undefined;
  const ids = [data["@id"], ...(data.subClassOf || []).map((x) => x["@id"])];
  (KnownRelationEntities[data.label] || []).map((curie) => {
    curie = curieToIri(curie);
    if (knownIris[curie] !== undefined) relationType = knownIris[curie];
  });
  if (relationType === undefined)
    maybeAddKnownClass(ids, data.label, data["@id"], knownIris);
  let sourceId = data.domain["@id"];
  let destinationId = data.range["@id"];
  sourceId = knownIris[sourceId] || sourceId;
  destinationId = knownIris[destinationId] || destinationId;
  if (sourceId === undefined || destinationId === undefined) return null;
  // TODO: find the names of source and dest class
  const refContent: Record<string, string> = {
    source: sourceId,
    destination: destinationId,
  };
  if (relationType) refContent["relation_type"] = relationType;
  return {
    literal_content: { roles: ["source", "destination"], label: data.label },
    local_reference_content: refContent,
    is_schema: true,
    name: `${sourceId} -${data.label}-> ${destinationId}`,
    ...baseInterpretId(data["@id"]),
    ...parseBaseData(data),
  };
};

const parseRelationInstance = (
  data: RelationInstanceProfile,
  knownIris: Record<string, string>,
): LocalConceptDataInput | null => {
  if (data["@id"] == null) return null;
  const schemaInfos = data.type.map((x) =>
    interpretId(
      x["@id"],
      "schema_id",
      "schema_represented_by_local_id",
      knownIris,
    ),
  );
  const schemaInfo = schemaInfos[0];
  if (!schemaInfo) return null;
  // TODO If there's many types, how to choose?
  const source = data.source["@id"];
  const destination = data.destination["@id"];
  // TODO: find the names of source and dest instances, rel label
  return {
    ...schemaInfo,
    name: `${source} -${"schema_represented_by_local_id" in schemaInfo ? schemaInfo.schema_represented_by_local_id : schemaInfo.schema_id}-> ${destination}`,
    local_reference_content: { source, destination },
    ...interpretId(data["@id"], "id", "source_local_id"),
    ...parseBaseData(data),
  };
};

const parseLdoNode = async (
  data: NodeParseResult,
  contentById: Record<string, ContentProfile>,
  knownIris: Record<string, string>,
  knownSchemaTypes: Record<string, string>,
  dataset: LdoDataset,
): Promise<LocalConceptDataInput | null> => {
  if (!data["@id"]) {
    console.error("No @id: ", data);
    return null;
  }
  const typesA = data.type.map((x) => x["@id"]);
  const types = new Set<string>(typesA);
  if (types.size === 0) return null;
  if (
    types.has("RelationDef") &&
    (data as RelationDefProfile).domain &&
    (data as RelationDefProfile).range
  )
    return await addExtraData(
      dataset,
      data["@id"],
      RelationDefProfileShapeType,
      parseRelationDef(data as RelationDefProfile, knownIris),
    );
  else if (types.has("AbstractRelationDef") || types.has("RelationDef"))
    return await addExtraData(
      dataset,
      data["@id"],
      AbstractRelationDefProfileShapeType,
      parseAbstractRelationDef(data as AbstractRelationDefProfile, knownIris),
    );
  if (types.has("NodeSchema"))
    return await addExtraData(
      dataset,
      data["@id"],
      NodeSchemaProfileShapeType,
      parseNodeSchema(data as NodeSchemaProfile, knownIris),
    );

  // now instance heuristics
  let schemaType: string | undefined;
  typesA.map((t) => {
    if (knownSchemaTypes[t]) schemaType = knownSchemaTypes[t];
    const v2 = knownIris[t];
    if (v2 && knownSchemaTypes[v2]) schemaType = knownSchemaTypes[v2];
  });
  if (schemaType === nodeSchemaType) {
    const nodeInstance = data as NodeInstanceProfile;
    if (!nodeInstance.description) return null;
    const content =
      nodeInstance.description.content !== undefined
        ? nodeInstance.description
        : contentById[nodeInstance.description["@id"]!];
    if (!content) return null;
    return await addExtraData(
      dataset,
      data["@id"],
      NodeInstanceProfileShapeType,
      parseNodeInstance(nodeInstance, content, knownIris),
    );
  }
  if (schemaType === relationDefType || schemaType === abstractRelationDefType)
    return await addExtraData(
      dataset,
      data["@id"],
      RelationInstanceProfileShapeType,
      parseRelationInstance(data as RelationInstanceProfile, knownIris),
    );

  console.error("We should not get here", [...types], data);
  return null;
};

const nodeOrder = [
  "NodeSchema",
  "AbstractRelationDef",
  "RelationDef",
  "NodeInstance",
  "RelationInstance",
];

export const parseJsonLdAsDataInputWithSchemas = async ({
  data,
  baseIRI,
  knownIris,
  knownSchemaTypes,
  platform,
}: {
  data: JsonLdDocument;
  baseIRI: string;
  knownIris: Record<string, string>;
  knownSchemaTypes: Record<string, SchemaTypes>;
  platform: PlatformType;
}): Promise<{
  concepts: LocalConceptDataInput[];
  accounts: LocalAccountDataInput[];
}> => {
  const dataset = await parseJsonLdAsLdoDataset(data, baseIRI);
  const ldoData = await extractLdoData(dataset, knownIris, knownSchemaTypes);
  if (ldoData.length === 0) return { concepts: [], accounts: [] };
  const accountIds: string[] = dataset
    .match(null, namedNode(typePredicate), namedNode(accountType))
    .toArray()
    .map((q) => q.subject.value);
  const accountsLdo = ldoData.filter((d) =>
    accountIds.includes(d["@id"] || ""),
  ) as PersonAccountProfile[];

  const accounts = accountsLdo
    .map((p) => parsePersonDef(p, platform))
    .filter((p) => p !== null);

  const contentIds: string[] = dataset
    .match(null, namedNode(descriptionPredicate))
    .toArray()
    .map((q) => (q.object as NamedNode).value);
  const contents = ldoData.filter((d) =>
    contentIds.includes(d["@id"] || ""),
  ) as ContentProfile[];
  // assume single content for now
  const contentById = Object.fromEntries(
    contents.map((c) => [c["@id"], c]),
  ) as Record<string, ContentProfile>;
  const processed = new Set([...contentIds, ...accountIds]);
  const nodes = ldoData.filter(
    (d) => !processed.has(d["@id"] || ""),
  ) as NodeParseResult[];
  // Reorder, put schemas first, relations last.
  nodes.sort((n1, n2) => {
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
  const concepts = (
    await Promise.all(
      nodes.map((d) =>
        parseLdoNode(d, contentById, knownIris, knownSchemaTypes, dataset),
      ),
    )
  ).filter((x) => !!x);

  return {
    accounts,
    concepts,
  };
};

export const parseJsonLdAsInput = async (
  supabase: DGSupabaseClient,
  jsonLdData: JsonLdDocument,
  spaceId: number,
): Promise<{
  concepts: LocalConceptDataInput[];
  accounts: LocalAccountDataInput[];
}> => {
  const baseIRI = `${apiRoot}/data/${spaceId}`;
  let platform: PlatformType | undefined;
  {
    const { error, data } = await supabase
      .from("Space")
      .select("platform")
      .eq("id", spaceId)
      .single();
    if (error) throw error;
    platform = data?.platform;
    if (!platform) throw new Error("Cannot determine platform");
  }
  const { error, data } = await supabase
    .from("Concept")
    .select("name,source_local_id,arity,reference_content")
    .eq("space_id", spaceId)
    .eq("is_schema", true);
  if (error) throw error;
  const knownIris = Object.fromEntries(
    data
      .filter(({ source_local_id }) => source_local_id !== null)
      .map(({ name, source_local_id }) =>
        (KnownSchemaEntities[name] || []).map((c) => [
          curieToIri(c),
          source_local_id!,
        ]),
      )
      .flat(),
  ) as Record<string, string>;
  const knownSchemaTypes = Object.fromEntries(
    data
      .filter(({ source_local_id }) => source_local_id !== null)
      .map(({ source_local_id, arity, reference_content }) => {
        if (arity !== 2) return [source_local_id, nodeSchemaType];
        if (
          (reference_content as Record<string, Json>).source &&
          (reference_content as Record<string, Json>).destination
        ) {
          return [source_local_id, relationDefType];
        } else {
          return [source_local_id, abstractRelationDefType];
        }
      }),
  ) as Record<string, SchemaTypes>;
  return await parseJsonLdAsDataInputWithSchemas({
    data: jsonLdData,
    baseIRI,
    knownIris,
    knownSchemaTypes,
    platform,
  });
};

export const populate = async (
  supabase: DGSupabaseClient,
  jsonLdData: JsonLdDocument,
  spaceId: number,
): Promise<number[]> => {
  const result: number[] = [];
  const { concepts, accounts } = await parseJsonLdAsInput(
    supabase,
    jsonLdData,
    spaceId,
  );
  if (accounts.length) {
    const { data: upsertResult, error: upsertError } = await supabase.rpc(
      "upsert_accounts_in_space",
      {
        accounts,
        space_id_: spaceId,
      },
    );
    if (upsertError) throw upsertError;
    result.push(...upsertResult);
  }

  if (concepts.length === 0) return [];
  const { data: upsertResult, error: upsertError } = await supabase.rpc(
    "upsert_concepts",
    {
      data: concepts as Json,
      v_space_id: spaceId,
    },
  );
  if (upsertError) throw upsertError;
  result.push(...upsertResult);
  return result;
};
