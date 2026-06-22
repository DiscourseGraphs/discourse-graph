import { Quad } from "@rdfjs/types";

declare module "rdf-utils-fs/fromFile" {
  export default function fromFile(
    filename: string,
    options?: { extensions?: Record },
  ): Source<Quad>;
}
