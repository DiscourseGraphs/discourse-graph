import type { DgAtJsonMetadata, DgDocument, JsonObject } from "./schema";
import { assertValidDgDocument } from "./validate";

const normalizeDerivedText = (text: string): string =>
  text
    .replace(/\0/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

export const derivePlainTextFromDgDocument = (document: DgDocument): string => {
  const title = normalizeDerivedText(document.title.text);
  const body = normalizeDerivedText(document.body.text);
  return [title, body].filter((part) => part.length > 0).join("\n\n");
};

export const createDgAtJsonMetadata = ({
  document,
  metadata = {},
}: {
  document: DgDocument;
  metadata?: JsonObject;
}): DgAtJsonMetadata => {
  assertValidDgDocument(document);
  return {
    ...metadata,
    content: document,
  };
};
