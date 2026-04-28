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
  wrap,
}: {
  space: Space;
  concept: Concept;
  baseUrl: string;
  title?: Content;
  schema?: Concept;
  content?: Content;
  author?: PlatformAccount;
  targetFormat?: string;
  wrap?: boolean;
}): Promise<Json> => {
  targetFormat ??= "html";
  const baseUrlSlash = baseUrl + "/";
  let schemaUrl = concept.arity ? "dgb:RelationSchema" : "dgb:NodeSchema";
  let extraData: Record<string, string> = {};
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
  const titleText = title?.text ?? concept.name;
  if (titleText) {
    extraData[concept.is_schema ? "label" : "title"] = titleText;
  }
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
  extraData = {
    "@id": baseUrlSlash + concept.id,
    "@type": schemaUrl,
    modified: concept.last_modified + "Z",
    created: concept.created + "Z",
    ...extraData,
  };
  return wrap ? wrapJsonLd(extraData, baseUrl) : extraData;
};

export const wrapJsonLd = (
  json: Json[] | Record<string, Json>,
  baseUrl: string,
): Json => {
  if (Array.isArray(json)) {
    return {
      "@context": [
        "/schema/context.jsonld",
        {
          local: baseUrl + "/",
        },
      ],
      "@id": baseUrl,
      "@graph": json,
    };
  } else if (typeof json === "object") {
    return {
      "@context": [
        "/schema/context.jsonld",
        {
          local: baseUrl + "/",
        },
      ],
      has_container: baseUrl,
      ...json,
    };
  } else throw new Error("Wrong input type");
};
