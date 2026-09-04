import type { StructuredDataDocument } from "~/utils/structuredData";

type JsonLdProps = {
  data: StructuredDataDocument;
};

export const serializeStructuredData = (data: StructuredDataDocument): string =>
  JSON.stringify(data)
    .replace(/</gu, "\\u003c")
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");

export const JsonLd = ({ data }: JsonLdProps): React.ReactElement => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }}
  />
);
