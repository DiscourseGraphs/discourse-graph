import type { Tables, Enums, Json } from "@repo/database/dbTypes";
import {
  convert,
  MIMETYPES,
  initRT,
  type DocType,
} from "~/utils/conversion/convert";

type Concept = Tables<"Concept">;
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
  describesActivity: ["dgc:describesActivity"],
  observationStatement: ["dgc:observationStatement"],
  observationOriginActivity: ["dgc:observationOriginActivity"],
  observationBase: ["dgc:observationBase"],
  sourceDocument: ["dgc:sourceDocument"],
  opposes: ["dgc:opposes"],
  opposedBy: ["dgc:opposedBy"],
  supports: ["dgc:supports"],
  supportedBy: ["dgc:supportedBy"],
  addresses: ["dgc:addresses"],
  addressedBy: ["dgc:addressedBy"],
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

const prefixes: Record<string, string> = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  dc: "http://purl.org/dc/elements/1.1/",
  dct: "http://purl.org/dc/terms/",
  prov: "http://www.w3.org/ns/prov#",
  sioc: "http://rdfs.org/sioc/ns#",
  dgb: "https://discoursegraphs.com/schema/dg_base#",
  dgc: "https://discoursegraphs.com/schema/dg_core#",
  mira: "http://purl.org/mira-science/mira#",
};

export const curieToIri = (curie: string): string => {
  const [prefix, name]: string[] = curie.split(":", 2);
  const iri = prefixes[prefix || ""];
  if (iri === undefined) {
    console.error("Unknown prefix", prefix);
    return curie;
  }
  return iri + name;
};

export const iriToCurie = (iri: string): string => {
  // not efficient, but not so many prefixes, and easier than determining the cut point
  for (const [prefix, base] of Object.entries(prefixes)) {
    if (iri.startsWith(base)) {
      return prefix + ":" + iri.substring(base.length);
    }
  }
  return iri;
};

export const KnownClassCuries = Object.values(KnownClassEntities).flat();
export const KnownClassIris = new Set(KnownClassCuries.map(curieToIri));
export const KnownRelationCuries = Object.values(KnownRelationEntities).flat();
export const KnownRelationIris = new Set(KnownRelationCuries.map(curieToIri));
export const KnownSchemaCuries = Object.values(KnownSchemaEntities).flat();
export const KnownSchemaIris = new Set(KnownSchemaCuries.map(curieToIri));

export const conceptName = (
  concept: Concept,
  schema: Concept | undefined,
): string => {
  if (concept.is_schema) {
    if (concept.arity !== 2)
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

export const asJsonLD = async ({
  platform,
  concept,
  baseUrl,
  title,
  schema,
  content,
  author,
  targetFormat,
  wrap,
}: {
  platform: Platform;
  concept: Concept;
  baseUrl: string;
  title?: Content;
  schema?: Concept;
  content?: Content;
  author?: PlatformAccount;
  targetFormat?: DocType;
  wrap?: boolean;
}): Promise<Record<string, Json>> => {
  targetFormat ??= "html";
  if (MIMETYPES[targetFormat] === undefined) {
    targetFormat = "html";
  }
  let schemaUrl: string | string[] = concept.schema_id
    ? "sdata:" + concept.schema_id
    : concept.arity === 2
      ? (concept.reference_content as Record<string, Json>).source !== undefined
        ? "RelationDef"
        : "AbstractRelationDef"
      : "NodeSchema";

  let extraData: Record<string, string | Json> = {};
  if (
    schema &&
    schema.arity &&
    schema.literal_content !== null &&
    typeof schema.literal_content === "object" &&
    !Array.isArray(schema.literal_content) &&
    concept.reference_content !== null &&
    typeof concept.reference_content === "object" &&
    !Array.isArray(concept.reference_content) &&
    Array.isArray(schema.literal_content.roles)
  ) {
    for (const role of schema.literal_content.roles) {
      if (typeof role !== "string") continue;
      const val = concept.reference_content[role];
      if (val && typeof val === "number") extraData[role] = `sdata:${val}`;
    }
  }
  if (schema !== undefined) {
    const knownSchemas = KnownSchemaEntities[schema?.name ?? ""];
    if (knownSchemas !== undefined) {
      schemaUrl = [schemaUrl, ...knownSchemas];
    }
  } else if (concept.is_schema) {
    const subClasses: Array<Json> = [];
    const knownSchemas = KnownSchemaEntities[concept.name];
    // in that case we can skip the base class
    if (knownSchemas !== undefined) {
      subClasses.push(...knownSchemas);
    }
    if (concept.arity === 2) {
      // triple vs abstract def
      const abstractRelType = (
        concept.reference_content as Record<string, Json>
      ).relation_type;
      if (typeof abstractRelType === "number") {
        subClasses.push("sdata:" + abstractRelType);
      } else {
        // Explicit punning
        subClasses.push("dgb:RelationInstance", {
          "@type": "owl:Restriction",
          onProperty: "rdf:predicate",
          hasValue: "sdata:" + concept.id,
        });
      }
    }
    if (subClasses.length > 1) extraData["subClassOf"] = subClasses;
    else if (subClasses.length === 1) extraData["subClassOf"] = subClasses[0]!;
  }

  const titleText = title?.text ?? concept.name;
  if (titleText) {
    extraData[concept.is_schema ? "label" : "title"] = titleText;
  }
  let pageUrl: string | undefined = undefined;
  if (content) {
    const rootUrl = baseUrl.split("/").slice(0, 3).join("/");
    pageUrl = `${rootUrl}/api/content/${baseUrl.split("/")[5]}/${concept.id}#`;
    await initRT(rootUrl);
    const source: DocType | undefined =
      platform === "Obsidian"
        ? "obsidian"
        : platform === "Roam"
          ? content.text[0] === "{"
            ? "roam"
            : "markdown"
          : undefined;
    const contentText =
      source && (await convert(content.text, source, targetFormat));
    extraData["description"] = {
      "@id": "page:content",
      format: MIMETYPES[targetFormat],
      content: contentText,
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
    concept.literal_content !== null &&
    (concept.literal_content as Record<string, Json>).extra !== undefined
  )
    extraData = {
      ...extraData,
      ...((concept.literal_content as Record<string, Json>).extra as Record<
        string,
        string | string[]
      >),
    };
  let lastModified = concept.last_modified;
  if (content && content.last_modified > lastModified)
    lastModified = content.last_modified;
  if (title && title.last_modified > lastModified)
    lastModified = title.last_modified;
  extraData = {
    "@id": "sdata:" + concept.id,
    "@type": schemaUrl,
    modified: lastModified + "Z",
    created: concept.created + "Z",
    ...extraData,
  };
  return wrap ? wrapJsonLd(extraData, baseUrl, pageUrl) : extraData;
};

export const wrapJsonLd = (
  json: Json[] | Record<string, Json>,
  baseUrl: string,
  pageUrl?: string,
): Record<string, Json> => {
  const rootUrl = baseUrl.split("/").slice(0, 3).join("/");
  const ctxUrl = rootUrl + "/schema/context.jsonld";
  const localCtx: Record<string, string> = {
    sdata: baseUrl + "/",
  };
  if (pageUrl) localCtx["page"] = pageUrl;
  if (Array.isArray(json)) {
    return {
      "@context": [ctxUrl, localCtx],
      "@id": baseUrl,
      "@graph": json,
    };
  } else if (typeof json === "object") {
    return {
      "@context": [ctxUrl, localCtx],
      has_container: baseUrl,
      ...json,
    };
  } else throw new Error("Wrong input type");
};
