import { Tables, Json } from "@repo/database/dbTypes";
import { convert, MIMETYPES, type DocType } from "~/utils/conversion/convert";

type Concept = Tables<"Concept">;
type Content = Tables<"Content">;
type Space = Tables<"Space">;
type PlatformAccount = Tables<"PlatformAccount">;

// This is a temporary hack
const KnownSchemaEntities: Record<string, string[]> = {
  Claim: ["dgc"],
  Evidence: ["dgc"],
  Question: ["dgc"],
  SourceDocument: ["dgc"],
  describesActivity: ["dgc"],
  observationStatement: ["dgc"],
  observationOriginActivity: ["dgc"],
  observationBase: ["dgc"],
  sourceDocument: ["dgc"],
  opposes: ["dgc"],
  opposedBy: ["dgc"],
  supports: ["dgc"],
  supportedBy: ["dgc"],
  addresses: ["dgc"],
  addressedBy: ["dgc"],
};

export const asJsonLD = ({
  space,
  concept,
  baseUrl,
  title,
  schema,
  content,
  author,
  targetFormat,
  wrap,
}: {
  space: Space;
  concept: Concept;
  baseUrl: string;
  title?: Content;
  schema?: Concept;
  content?: Content;
  author?: PlatformAccount;
  targetFormat?: DocType;
  wrap?: boolean;
}): Record<string, Json> => {
  targetFormat ??= "html";
  if (MIMETYPES[targetFormat] === undefined) {
    targetFormat = "html";
  }
  let schemaUrl: string | string[] = concept.schema_id
    ? "sdata:" + concept.schema_id
    : concept.arity === 2
      ? "RelationDef"
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
      schemaUrl = [
        schemaUrl,
        ...knownSchemas.map((s) => `${s}:${schema.name}`),
      ];
    }
  } else if (concept.is_schema) {
    const subClasses: Array<Json> = [];
    const knownSchemas = KnownSchemaEntities[concept.name];
    // in that case we can skip the base class
    if (knownSchemas !== undefined) {
      subClasses.push(...knownSchemas.map((s) => `${s}:${concept.name}`));
    }
    if (concept.arity === 2) {
      // Explicit punning
      subClasses.push("dgb:RelationInstance", {
        "@type": "owl:Restriction",
        onProperty: "rdf:predicate",
        hasValue: "sdata:" + concept.id,
      });
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
    const source: DocType | undefined =
      space.platform === "Obsidian" ? "obsidian" : "markdown";
    // punt roam-json
    const contentText = source && convert(content.text, source, targetFormat);
    extraData["description"] = {
      "@id": "page:content",
      format: MIMETYPES[targetFormat],
      content: contentText,
    };
  }

  if (author) {
    extraData.creator = author.name;
    // TODO: make into an object?
  }
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
