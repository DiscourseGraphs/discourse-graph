import type { Tables, Enums, Json } from "@repo/database/dbTypes";
import type { ColumnRow } from "@repo/database/inputTypes";
import { convert, MIMETYPES, type DocType } from "~/utils/conversion/convert";
import type { ConceptAddresses } from "~/utils/conversion/nodeLookup";

type Concept = ColumnRow<"Concept">;
type Content = Tables<"Content">;
type PlatformAccount = Tables<"PlatformAccount">;
type Platform = Enums<"Platform">;

// This is a temporary hack
export const KnownClassEntities: Record<string, string[]> = {
  Claim: ["dgc:Claim", "mira:Claim"],
  Evidence: ["dgc:Evidence", "mira:Evidence"],
  Question: ["dgc:Question", "mira:Question"],
  SourceDocument: ["dgc:SourceDocument"],
  Request: ["mira:Request"],
  Protocol: ["mira:Protocol"],
};
export const KnownRelationEntities: Record<string, string[]> = {
  describesActivity: ["dgc:describesActivity", "mira:describesActivity"],
  observationStatement: [
    "dgc:observationStatement",
    "mira:observationStatement",
  ],
  observationOriginActivity: [
    "dgc:observationOriginActivity",
    "mira:observationOriginActivity",
  ],
  observationBase: ["dgc:observationBase", "mira:observationBase"],
  sourceDocument: ["dgc:sourceDocument", "mira:sourceDocument"],
  opposes: ["dgc:opposes", "mira:opposes"],
  opposedBy: ["dgc:opposedBy", "mira:opposedBy"],
  supports: ["dgc:supports", "mira:supports"],
  supportedBy: ["dgc:supportedBy", "mira:supportedBy"],
  informs: ["dgc:addresses", "mira:addresses"], // Obsidian synonym
  informedBy: ["dgc:addressedBy", "mira:addressedBy"],
  addresses: ["dgc:addresses", "mira:addresses"],
  addressedBy: ["dgc:addressedBy", "mira:addressedBy"],
  follows: ["mira:follows"],
  grounds: ["mira:grounds"],
  is_grounded_in: ["mira:is_grounded_in"],
  request_for: ["mira:request_for"],
  request_target: ["mira:request_target"],
};

export const KnownSchemaEntities: Record<string, string[]> = {
  ...KnownClassEntities,
  ...KnownRelationEntities,
};

export const conceptName = (
  concept: Concept,
  schema: Concept | undefined,
): string => {
  if (concept.is_schema) {
    if (!concept.is_relation)
      return "https://discoursegraphs.com/schema/dg_base#NodeSchema";
    const ref = (concept.reference_content || {}) as Record<
      string,
      number | number[]
    >;
    if (ref["source"])
      return "https://discoursegraphs.com/schema/dg_base#RelationDefSchema";
    return "https://discoursegraphs.com/schema/dg_base#AbstractRelationDefSchema";
  }
  const name = schema?.name;
  if (!name) return "document"; // really an error here
  const entities = KnownSchemaEntities[name];
  if (!entities) return name;
  return entities[0]!;
};

// The property that links a node's address to its RID is not settled
// (owl:sameAs, dct:identifier, or one of our own); change it only here.
export const ridLink = (rid: string): Record<string, string> => ({
  sameAs: rid,
});

// Nodes of the document's own space are written as `sdata:` compact IRIs;
// nodes of other spaces keep their full IRI, which is the same in every document.
export const OWN_SPACE_PREFIX = "sdata";

const compactIri = (iri: string, ownSpaceUrl: string): string => {
  const ownPrefix = `${ownSpaceUrl}/`;
  return iri.startsWith(ownPrefix)
    ? `${OWN_SPACE_PREFIX}:${iri.substring(ownPrefix.length)}`
    : iri;
};

export const schemaLabel = (concept: Concept): string => {
  const literal = concept.literal_content;
  if (literal && typeof literal === "object" && !Array.isArray(literal)) {
    const label = literal.label;
    if (typeof label === "string" && label.length > 0) return label;
  }
  return concept.name;
};

const isJsonObject = (value: Json): value is Record<string, Json> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const asJsonLD = ({
  platform,
  concept,
  addresses,
  ownSpaceUrl,
  title,
  schema,
  content,
  bodyUrl,
  author,
  targetFormat,
  wrap,
}: {
  platform: Platform;
  concept: Concept;
  addresses: ConceptAddresses;
  // The data address of the space the document is served from.
  ownSpaceUrl: string;
  title?: Content;
  schema?: Concept;
  content?: Content;
  // The raw body text, which names the node's content.
  bodyUrl?: string;
  author?: PlatformAccount;
  targetFormat?: DocType;
  wrap?: boolean;
}): Record<string, Json> => {
  targetFormat ??= "html";
  if (MIMETYPES[targetFormat] === undefined) {
    targetFormat = "html";
  }
  const ref = (conceptId: number): string | undefined => {
    const iri = addresses.iriOf(conceptId);
    return iri && compactIri(iri, ownSpaceUrl);
  };
  const ownIri = ref(concept.id);
  if (!ownIri) throw new Error(`Concept ${concept.id} has no address`);
  const referenceContent = isJsonObject(concept.reference_content ?? null)
    ? (concept.reference_content as Record<string, Json>)
    : {};

  const types: Json[] = [];
  if (concept.schema_id) {
    const schemaIri = ref(concept.schema_id);
    if (schemaIri) types.push(schemaIri);
  } else if (concept.is_relation) {
    types.push(
      referenceContent.source !== undefined
        ? "RelationDef"
        : "AbstractRelationDef",
    );
  } else {
    types.push("NodeSchema");
  }

  let extraData: Record<string, Json> = {};
  if (
    schema &&
    schema.arity > 0 &&
    isJsonObject(schema.literal_content ?? null) &&
    Array.isArray((schema.literal_content as Record<string, Json>).roles)
  ) {
    const roles = (schema.literal_content as Record<string, Json>)
      .roles as Json[];
    for (const role of roles) {
      if (typeof role !== "string") continue;
      const value = referenceContent[role];
      if (typeof value !== "number") continue;
      const roleIri = ref(value);
      if (roleIri) extraData[role] = roleIri;
    }
  }
  if (schema !== undefined) {
    types.push(...(KnownSchemaEntities[schema.name] ?? []));
  } else if (concept.is_schema) {
    const subClasses: Json[] = [];
    subClasses.push(...(KnownSchemaEntities[concept.name] ?? []));
    if (concept.is_relation) {
      const abstractRelationType = referenceContent.relation_type;
      if (typeof abstractRelationType === "number") {
        const abstractIri = ref(abstractRelationType);
        if (abstractIri) subClasses.push(abstractIri);
      } else {
        // Explicit punning
        subClasses.push("dgb:RelationInstance", {
          "@type": "owl:Restriction",
          onProperty: "rdf:predicate",
          hasValue: ownIri,
        });
      }
    }
    if (subClasses.length > 1) extraData["subClassOf"] = subClasses;
    else if (subClasses.length === 1) extraData["subClassOf"] = subClasses[0]!;
  }

  if (concept.is_schema) {
    extraData["label"] = schemaLabel(concept);
  } else {
    const titleText = title?.text ?? concept.name;
    if (titleText) extraData["title"] = titleText;
  }
  if (content && bodyUrl) {
    const source: DocType = platform === "Obsidian" ? "obsidian" : "markdown";
    // punt roam-json
    extraData["description"] = {
      "@id": bodyUrl,
      format: MIMETYPES[targetFormat],
      content: convert(content.text, source, targetFormat),
    };
  }

  if (author) {
    extraData.creator = {
      // TODO: ensure it's a URL
      "@id": author.account_local_id,
      "@type": "UserAccount",
      name: author.name,
    };
  }
  if (
    isJsonObject(concept.literal_content ?? null) &&
    isJsonObject(
      (concept.literal_content as Record<string, Json>).extra ?? null,
    )
  )
    extraData = {
      ...extraData,
      ...((concept.literal_content as Record<string, Json>).extra as Record<
        string,
        Json
      >),
    };
  let lastModified = concept.last_modified;
  if (content && content.last_modified > lastModified)
    lastModified = content.last_modified;
  if (title && title.last_modified > lastModified)
    lastModified = title.last_modified;
  const rid = addresses.ridOf(concept.id);
  const nodeData: Record<string, Json> = {
    "@id": ownIri,
    "@type": types.length === 1 ? types[0]! : types,
    ...(rid ? ridLink(rid) : {}),
    modified: lastModified + "Z",
    created: concept.created + "Z",
    ...extraData,
  };
  return wrap ? wrapJsonLd({ json: nodeData, ownSpaceUrl }) : nodeData;
};

export const wrapJsonLd = ({
  json,
  ownSpaceUrl,
  documentUrl,
}: {
  json: Json[] | Record<string, Json>;
  ownSpaceUrl: string;
  // Names the document when it holds several nodes.
  documentUrl?: string;
}): Record<string, Json> => {
  const ctxUrl = `${new URL(ownSpaceUrl).origin}/schema/context.jsonld`;
  const localCtx: Record<string, string> = {
    [OWN_SPACE_PREFIX]: `${ownSpaceUrl}/`,
  };
  if (Array.isArray(json)) {
    return {
      "@context": [ctxUrl, localCtx],
      ...(documentUrl ? { "@id": documentUrl } : {}),
      "@graph": json,
    };
  }
  return {
    "@context": [ctxUrl, localCtx],
    has_container: ownSpaceUrl,
    ...json,
  };
};
