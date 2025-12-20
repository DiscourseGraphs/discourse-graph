import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import type { Result } from "roamjs-components/types/query-builder";
import type { DiscourseRelation } from "./getDiscourseRelations";
import type { DiscourseNode } from "./getDiscourseNodes";
import getPageMetadata from "./getPageMetadata";
import { pageToMarkdown } from "./pageToMardkown";
import { getRelationDataUtil } from "./getRelationData";
import { uniqJsonArray, getPageData } from "./exportUtils";
import { getExportSettings } from "./getExportSettings";

export const getJsonLdData = async ({
  results,
  allNodes,
  allRelations,
  nodeLabelByType,
  updateExportProgress,
}: {
  results: Result[];
  allNodes: DiscourseNode[];
  allRelations: DiscourseRelation[];
  nodeLabelByType: Record<string, string>;
  updateExportProgress: (progress: number) => void;
}) => {
  const roamUrl = getRoamUrl();
  const getRelationData = () =>
    getRelationDataUtil(allRelations, nodeLabelByType);
  updateExportProgress(0);
  // skip a beat to let progress render
  await new Promise((resolve) => setTimeout(resolve));
  const pageData = await getPageData({ results, allNodes });
  const numPages = pageData.length + allNodes.length;
  let numTreatedPages = 0;
  const context = {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    prov: "http://www.w3.org/ns/prov#",
    sioc: "http://rdfs.org/sioc/ns#",
    dg: "https://discoursegraphs.com/schema/dg_core#",
    subClassOf: "rdfs:subClassOf",
    title: "dc:title",
    modified: "dc:modified",
    created: "dc:date",
    creator: "dc:creator",
    content: "sioc:content",
    source: "dg:source",
    destination: "dg:destination",
    reltype: "dg:reltype",
    pages: `${roamUrl}/page/`,
  };
  const settings = {
    ...getExportSettings(),
    includeDiscourseContext: false,
  };
  // TODO : Identify existing CURIES in the node definition
  /* eslint-disable @typescript-eslint/naming-convention */
  const nodeSchemaData = await Promise.all(
    allNodes.map(async (node: DiscourseNode) => {
      const { date, displayName, modified } = getPageMetadata(node.text);
      const r = await pageToMarkdown(
        {
          text: node.text,
          uid: node.type,
        },
        { ...settings, allNodes },
      );
      numTreatedPages += 1;
      updateExportProgress(0.1 + (numTreatedPages / numPages) * 0.75);
      await new Promise((resolve) => setTimeout(resolve));
      return {
        "@id": `pages:${node.type}`,
        "@type": "dg:NodeSchema",
        title: node.text,
        content: r.content,
        modified: modified?.toJSON(),
        created: date.toJSON(),
        creator: displayName,
      };
    }),
  );
  const relSchemaData = allRelations.map((r: DiscourseRelation) => ({
    "@id": `pages:${r.id}`,
    "@type": "dg:BinaryRelationSchema",
    subClassOf: [
      {
        "@type": "owl:Restriction",
        "owl:onProperty": "dg:source",
        "owl:allValuesFrom": `pages:${r.source}`,
      },
      {
        "@type": "owl:Restriction",
        "owl:onProperty": "dg:destination",
        "owl:allValuesFrom": `pages:${r.destination}`,
      },
    ],
    title: r.label,
  }));
  const schemaData = [...nodeSchemaData, ...relSchemaData];

  const schemaUriByName = Object.fromEntries(
    schemaData.map((node) => [node.title, node["@id"]]),
  );

  const inverseRelSchemaData = allRelations.map((r: DiscourseRelation) => ({
    "@id": `pages:${r.id}-inverse`,
    "@type": "dg:BinaryRelationSchema",
    subClassOf: [
      {
        "@type": "owl:Restriction",
        "owl:onProperty": "dg:source",
        "owl:allValuesFrom": `pages:${r.destination}`,
      },
      {
        "@type": "owl:Restriction",
        "owl:onProperty": "dg:destination",
        "owl:allValuesFrom": `pages:${r.source}`,
      },
    ],
    title: r.complement,
    "owl:inverse-of": `pages:${r.id}`,
  }));

  await Promise.all(
    pageData.map(async (page: Result) => {
      const r = await pageToMarkdown(page, {
        ...settings,
        allNodes,
      });
      page.content = r.content;
      numTreatedPages += 1;
      updateExportProgress(0.1 + (numTreatedPages / numPages) * 0.75);
      await new Promise((resolve) => setTimeout(resolve));
    }),
  );

  // skip a beat to let progress render
  await new Promise((resolve) => setTimeout(resolve));
  await Promise.all(
    pageData.map(async (page: Result) => {
      const r = await pageToMarkdown(page, {
        ...settings,
        allNodes,
      });
      page.content = r.content;
      numTreatedPages += 1;
      updateExportProgress(0.1 + (numTreatedPages / numPages) * 0.75);
      await new Promise((resolve) => setTimeout(resolve));
    }),
  );

  const nodes = pageData.map(({ text, uid, content, type }) => {
    const { date, displayName, modified } = getPageMetadata(text);
    return {
      "@id": `pages:${uid}`,
      "@type": schemaUriByName[type],
      title: text,
      content,
      modified: modified?.toJSON(),
      created: date.toJSON(),
      creator: displayName,
    };
  });
  const nodeSet = new Set(pageData.map((n) => n.uid));
  const rels = await getRelationData();
  updateExportProgress(1);
  await new Promise((resolve) => setTimeout(resolve));
  const relations = uniqJsonArray(
    rels.filter((r) => nodeSet.has(r.source) && nodeSet.has(r.target)),
  );
  const relData = relations.map(({ source, target, label }) => ({
    // no id yet, just a blank node
    "@type": "dg:BinaryRelation",
    reltype: schemaUriByName[label],
    source: `pages:${source}`,
    destination: `pages:${target}`,
  }));
  return {
    "@context": context,
    "@id": roamUrl,
    "prov:generatedAtTime": new Date().toISOString(),
    "@graph": [...schemaData, ...inverseRelSchemaData, ...nodes, ...relData],
  };
  /* eslint-enable @typescript-eslint/naming-convention */
};
