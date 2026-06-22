import { DG_DOCUMENT_VERSION } from "./constants";
import type {
  BodyDocument,
  DgDocument,
  JsonObject,
  TextDocument,
} from "./schema";

export const createTextDocument = (text: string): TextDocument => ({
  text,
  annotations: [],
});

export const createBodyDocument = (text: string): BodyDocument => ({
  text,
  annotations: [],
});

export const createDgDocument = ({
  title,
  body,
  metadata,
}: {
  title: TextDocument | string;
  body: BodyDocument | string;
  metadata?: JsonObject;
}): DgDocument => ({
  version: DG_DOCUMENT_VERSION,
  title: typeof title === "string" ? createTextDocument(title) : title,
  body: typeof body === "string" ? createBodyDocument(body) : body,
  ...(metadata ? { metadata } : {}),
});

export const derivePlainTextFromDgDocument = (document: DgDocument): string => {
  const sections = [
    document.title.text.trim(),
    document.body.text.trim(),
  ].filter(Boolean);
  return sections.join("\n\n");
};

export const createAtJsonContentMetadata = (
  document: DgDocument,
): { content: DgDocument } => ({
  content: document,
});
