import type { Readable } from "readable-stream";
import type { Stream } from "@rdfjs/types";

declare module "@rdfjs/sink-map" {
  class SinkMap extends Map {
    import(key: string, input: Readable, options?: Record): Stream;
  }
  export default SinkMap;
}
