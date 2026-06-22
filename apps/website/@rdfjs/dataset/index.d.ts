import { DatasetFactory } from "@rdfjs/types";

declare module "@rdfjs/dataset" {
  const factory: DatasetFactory;
  export default factory;
}
