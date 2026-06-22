import { Dataset, Quad } from "@rdfjs/types";
import rdfDataModel from "@rdfjs/data-model";
import rdfDataset from "@rdfjs/dataset";
import { Validator } from "shacl-engine";
import { toRDF, type JsonLdDocument } from "jsonld";
import { Parser, Writer } from "n3";
import { readFileSync } from "node:fs";

export const buildValidator = (): Validator => {
  const filename = new URL("./shacl/mira.shacl.ttl", import.meta.url);
  const dataset = rdfDataset.dataset();

  const parser = new Parser();
  const data = readFileSync(filename.pathname).toString();
  const quads = parser.parse(data);
  for (const quad of quads) dataset.add(quad);
  return new Validator(dataset, { factory: rdfDataModel, coverage: true });
};

export const validateDataset = async (dataset: Dataset) => {
  const validator = buildValidator();
  // TODO: Cache
  const report = await validator.validate({ dataset });
  console.log("conforms:", report.conforms);
  if (report.conforms) return true;
  const writer = new Writer();
  const results = report.results.map((r) => {
    console.log(r);
    return [r.message.map((x) => x.value), writer.quadsToString(r.coverage())];
  });
  console.log("results:", results);
  // check if the data conforms to the given shape
  return results;
};

export const validateJsonLd = async (data: JsonLdDocument) => {
  const quads = (await toRDF(data)) as Quad[];
  const dataset = rdfDataset.dataset();
  for (const quad of quads) dataset.add(quad);
  return await validateDataset(dataset);
};
