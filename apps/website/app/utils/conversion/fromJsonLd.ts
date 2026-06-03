import { namedNode } from "@ldo/rdf-utils";
import { parseRdf } from "@ldo/ldo";
import { toRDF, type JsonLdDocument } from "jsonld";
import {
  ContainerProfileShapeType,
  ContentProfileShapeType,
  NodeSchemaProfileShapeType,
  NodeInstanceProfileShapeType,
  RelationInstanceProfileShapeType,
  RelationTripleDefProfileShapeType,
  RelationDefProfileShapeType,
} from "./ldo/dgBase.shapeTypes";
import type {
  ContainerProfile,
  ContentProfile,
  NodeSchemaProfile,
  NodeInstanceProfile,
  RelationInstanceProfile,
  RelationTripleDefProfile,
  RelationDefProfile,
} from "./ldo/dgBase.typings";

type ParseResult =
  | ContainerProfile
  | ContentProfile
  | NodeSchemaProfile
  | NodeInstanceProfile
  | RelationInstanceProfile
  | RelationTripleDefProfile
  | RelationDefProfile;

const typePredicate = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const nodeSchemaType = "https://discoursegraphs.com/schema/dg_base#NodeSchema";
const relationDefType =
  "https://discoursegraphs.com/schema/dg_base#RelationDef";
const domainPredicate = "http://www.w3.org/1999/02/22-rdf-syntax-ns#domain";
const sourcePredicate = "https://discoursegraphs.com/schema/dg_base#source";
const contentPredicate = "http://rdfs.org/sioc/ns#content";
const descriptionPredicate = "http://purl.org/dc/elements/1.1/description";
const containerType = "http://rdfs.org/sioc/ns#Container";

export const parseJsonLd = async (
  data: JsonLdDocument,
  baseIRI: string,
): Promise<ParseResult[]> => {
  const asQuads = (await toRDF(data, {
    format: "application/n-quads",
  })) as string;
  const ldoDataset = await parseRdf(asQuads, {
    baseIRI,
  });
  const subjects = new Set(ldoDataset.toArray().map((q) => q.subject.value));
  const result: ParseResult[] = [];
  const typeMap: Record<string, string[]> = {};
  for (const q of ldoDataset.match(null, namedNode(typePredicate)).toArray()) {
    const s = q.subject.value;
    if (typeMap[s]) typeMap[s].push(q.object.value);
    else typeMap[s] = [q.object.value];
  }
  for (const subject of subjects) {
    const types = new Set(typeMap[subject]);
    if (types.has(containerType)) {
      result.push(
        ldoDataset.usingType(ContainerProfileShapeType).fromSubject(subject),
      );
      continue;
    }
    if (types.has(nodeSchemaType)) {
      result.push(
        ldoDataset.usingType(NodeSchemaProfileShapeType).fromSubject(subject),
      );
      continue;
    }
    if (types.has(relationDefType)) {
      if (ldoDataset.match(namedNode(subject), namedNode(domainPredicate)).size)
        result.push(
          ldoDataset
            .usingType(RelationTripleDefProfileShapeType)
            .fromSubject(subject),
        );
      else
        result.push(
          ldoDataset
            .usingType(RelationDefProfileShapeType)
            .fromSubject(subject),
        );
      continue;
    }
    if (
      ldoDataset.match(namedNode(subject), namedNode(contentPredicate)).size
    ) {
      result.push(
        ldoDataset.usingType(ContentProfileShapeType).fromSubject(subject),
      );
      continue;
    }
    // happy path: The types are there
    const typesOfTypes = new Set(
      (typeMap[subject] || []).map((t) => typeMap[t] || []).flat(),
    );
    if (typesOfTypes.has(relationDefType)) {
      result.push(
        ldoDataset
          .usingType(RelationInstanceProfileShapeType)
          .fromSubject(subject),
      );
      continue;
    }
    if (typesOfTypes.has(nodeSchemaType)) {
      result.push(
        ldoDataset.usingType(NodeInstanceProfileShapeType).fromSubject(subject),
      );
      continue;
    }
    // otherwise use heuristics
    if (ldoDataset.match(namedNode(subject), namedNode(sourcePredicate)).size) {
      result.push(
        ldoDataset
          .usingType(RelationInstanceProfileShapeType)
          .fromSubject(subject),
      );
      continue;
    }
    if (
      ldoDataset.match(namedNode(subject), namedNode(descriptionPredicate)).size
    ) {
      result.push(
        ldoDataset.usingType(NodeInstanceProfileShapeType).fromSubject(subject),
      );
      continue;
    }
    console.error("Could not interpret ", subject);
  }
  return result;
};
