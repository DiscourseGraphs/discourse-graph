import { DataFactory } from "@rdfjs/types";

declare module "@rdfjs/data-model" {
  const factory: DataFactory;
  export default factory;
}
