import type { Sink, Source } from "@rdfjs/types";
import SinkMap from "@rdfjs/sink-map";

declare module "@rdfjs/formats-common" {
  export const parsers: SinkMap;
  export const serializers: SinkMap;
  const formats = { parsers, serializers };
  export const JsonLdParser: Sink;
  export const N3Parser: Sink;
  export const RdfXmlParser: Sink;
  export const JsonLdSerializer: Source;
  export const NTriplesSerializer: Source;
  export default formats;
}
