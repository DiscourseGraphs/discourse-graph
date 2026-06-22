import { Dataset, DataFactory } from "@rdfjs/types";

declare module "shacl-engine" {
  export class Report {
    get conforms();
    get dataset(): Dataset;
    coverage(): Array;
  }
  export class Validator {
    constructor(
      dataset: Dataset,
      options: { factory: DataFactory; validations?: Record; coverage?: bool },
    );
    async validate(data: Dataset, shapes?: Dataset): Promise<Report>;
  }
}
