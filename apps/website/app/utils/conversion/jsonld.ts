import { Tables, Json } from "@repo/database/dbTypes";
import { convert, initRT } from "~/utils/conversion/relationaltext";

type Concept = Tables<"Concept">;
type Content = Tables<"Content">;
type Space = Tables<"Space">;
type PlatformAccount = Tables<"PlatformAccount">;

export const asJsonLD = async ({
  space,
  concept,
  baseUrl,
  title,
  schema,
  content,
  author,
  targetFormat,
}: {
  space: Space;
  concept: Concept;
  baseUrl: string;
  title?: Content;
  schema?: Concept;
  content?: Content;
  author?: PlatformAccount;
  targetFormat?: string;
}): Promise<Json> => {
  targetFormat ??= "html";
  const baseUrlSlash = baseUrl + "/";
  let schemaUrl = concept.arity ? "dgb:RelationSchema" : "dgb:NodeSchema";
  const extraData: Record<string, string> = {};
  if (schema) {
    schemaUrl = "local:" + schema.id;
    if (
      schema?.arity &&
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
        if (val && typeof val === "number") extraData[role] = `local:${val}`;
      }
    }
  }
  if (title) extraData["title"] = title.text;
  if (content) {
    const rootUrl = baseUrl.split("/").slice(0, 3).join("/");
    await initRT(rootUrl);
    const source: string | undefined =
      space.platform === "Obsidian"
        ? "obsidian"
        : space.platform === "Roam"
          ? "roam"
          : undefined;
    if (source && source !== targetFormat) {
      extraData["content"] = await convert(content.text, source, targetFormat);
    } else {
      extraData["content"] = content.text;
    }
  }

  if (author) {
    extraData.creator = author.name;
    // TODO: make into an object?
  }
  return {
    "@context": {
      local: baseUrlSlash,
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      owl: "http://www.w3.org/2002/07/owl#",
      dc: "http://purl.org/dc/elements/1.1/",
      prov: "http://www.w3.org/ns/prov#",
      sioc: "http://rdfs.org/sioc/ns#",
      dgc: "https://discoursegraphs.com/schema/dg_core",
      dgb: "https://discoursegraphs.com/schema/dg_base",
      subClassOf: "rdfs:subClassOf",
      title: "dc:title",
      label: "rdfs:label",
      modified: "dc:modified",
      created: "dc:date",
      creator: "dc:creator",
      content: "sioc:content",
      source: "dgb:source",
      destination: "dgb:destination",
      textRefersToNode: "dgb:textRefersToNode",
      predicate: "rdf:predicate",
      nodeSchema: "dgb:NodeSchema",
      relationDef: "dgb:RelationDef",
      relationInstance: "dgb:RelationInstance",
      inverseOf: "owl:inverseOf",
    },
    "@id": baseUrl,
    "@graph": [
      {
        "@id": baseUrlSlash + concept.id,
        "@type": schemaUrl,
        modified: concept.last_modified + "Z",
        created: concept.created + "Z",
        // title
        // content
        ...extraData,
      },
    ],
  };
};
