import type { Result } from "roamjs-components/types/query-builder";
import type { DiscourseRelation } from "./getDiscourseRelations";
import type { DiscourseNode } from "./getDiscourseNodes";
import getPageMetadata from "./getPageMetadata";
import { pageToMarkdown } from "./pageToMarkdown";
import { getRelationDataUtil } from "./getRelationData";
import { uniqJsonArray, getPageData } from "./exportUtils";
import { getExportSettings } from "./getExportSettings";
import canonicalRoamUrl from "./canonicalRoamUrl";
import internalError from "./internalError";

export const jsonLdContext = (baseUrl: string): Record<string, string> => ({
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  dc: "http://purl.org/dc/elements/1.1/",
  prov: "http://www.w3.org/ns/prov#",
  sioc: "http://rdfs.org/sioc/ns#",
  dgb: "https://discoursegraphs.com/schema/dg_base",
  dg: "https://discoursegraphs.com/schema/dg_core",
  subClassOf: "rdfs:subClassOf",
  title: "dc:title",
  label: "rdfs:label",
  modified: "dc:modified",
  created: "dc:date",
  creator: "dc:creator",
  content: "sioc:content",
  source: "dgb:source",
  destination: "dgb:destination",
  textRefersToNode: "dgb:textRefersToNode",
  predicate: "rdf:predicate",
  nodeSchema: "dgb:NodeSchema",
  relationDef: "dgb:RelationDef",
  relationInstance: "dgb:RelationInstance",
  inverseOf: "owl:inverseOf",
  backlink: "dg:backlink",
  pages: `${baseUrl}/page/`,
});

export const getJsonLdSchema = async ({
  allNodes,
  allRelations,
  updateExportProgress,
}: {
  allNodes: DiscourseNode[];
  allRelations: DiscourseRelation[];
  updateExportProgress: (progress: number) => Promise<void>;
}): Promise<Record<string, string>[]> => {
  let numTreatedPages = 0;
  const settings = {
    ...getExportSettings(),
    includeDiscourseContext: false,
  };
  // TODO : Identify existing CURIES in the node definition
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
      await updateExportProgress(numTreatedPages);
      return {
        "@id": `pages:${node.type}`, // eslint-disable-line @typescript-eslint/naming-convention
        "@type": "nodeSchema", // eslint-disable-line @typescript-eslint/naming-convention
        label: node.text,
        content: r.content,
        modified: modified?.toJSON(),
        created: date.toJSON(),
        creator: displayName,
      };
    }),
  );
  const relSchemaData = allRelations.map((r: DiscourseRelation) => ({
    "@id": `pages:${r.id}`, // eslint-disable-line @typescript-eslint/naming-convention
    "@type": "relationDef", // eslint-disable-line @typescript-eslint/naming-convention
    domain: `pages:${r.source}`,
    range: `pages:${r.destination}`,
    label: r.label,
  }));
  const inverseRelSchemaData = allRelations.map((r: DiscourseRelation) => ({
    "@id": `pages:${r.id}-inverse`, // eslint-disable-line @typescript-eslint/naming-convention
    "@type": "relationDef", // eslint-disable-line @typescript-eslint/naming-convention
    domain: `pages:${r.destination}`,
    range: `pages:${r.source}`,
    label: r.complement,
    inverseOf: `pages:${r.id}`,
  }));
  /* eslint-enable @typescript-eslint/naming-convention */
  return [...nodeSchemaData, ...relSchemaData, ...inverseRelSchemaData];
};

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
  updateExportProgress: (progress: number) => Promise<void>;
}): Promise<
  Record<
    string,
    string | Record<string, string> | Record<string, string | string[]>[]
  >
> => {
  const roamUrl = canonicalRoamUrl();
  const getRelationData = () =>
    getRelationDataUtil({ allRelations, nodeLabelByType });
  await updateExportProgress(0);
  const pageData = getPageData({ results, allNodes });
  const numPages = pageData.length + allNodes.length;
  let numTreatedPages = 0;
  const settings = {
    ...getExportSettings(),
    includeDiscourseContext: false,
  };
  const schemaData = await getJsonLdSchema({
    allNodes,
    allRelations,
    updateExportProgress: async (numTreatedPages: number) => {
      await updateExportProgress(0.1 + (numTreatedPages / numPages) * 0.75);
    },
  });

  const nodeSchemaUriByName = Object.fromEntries(
    schemaData
      .filter((s) => s.content !== undefined)
      .map((node) => [node.label, node["@id"]]),
  );
  const nodeSet = new Set(pageData.map((n) => n.uid));

  const nodes = await Promise.all(
    pageData.map(async (page: Result) => {
      const md = await pageToMarkdown(page, {
        ...settings,
        allNodes,
        linkType: "roam url",
      });
      const { content } = md;
      page.content = content;
      const { text, uid, type } = page;
      const { date, displayName, modified } = getPageMetadata(text);
      const nodeType = nodeSchemaUriByName[type as string];
      if (!nodeType) {
        internalError({
          error: `Unknown node type "${type as string}" for page "${text}"`,
        });
      }
      const backlinks = (
        await (window.roamAlphaAPI.data.backend.q(
          `[:find ?uid
        :where
          [?page :block/uid "${uid}"]
          [?block :block/page ?page]
          [or [?refBlock :block/refs ?block] [?refBlock :block/refs ?page]]
          [?refBlock :block/page ?refPage]
          [?refPage :block/uid ?uid]
          ]`,
        ) as Promise<Array<[string]>>)
      )
        .map((x) => x[0])
        .filter((x) => nodeSet.has(x));
      const r: Record<string, string | string[]> = {
        "@id": `pages:${uid}`, // eslint-disable-line @typescript-eslint/naming-convention
        "@type": nodeType ?? "nodeSchema", // eslint-disable-line @typescript-eslint/naming-convention
        title: text,
        content,
        modified: modified?.toJSON(),
        created: date.toJSON(),
        creator: displayName,
      };
      if (backlinks.length > 0) {
        r["backlinks"] = backlinks.map((x) => `pages:${x}`);
      }
      numTreatedPages += 1;
      await updateExportProgress(0.1 + (numTreatedPages / numPages) * 0.75);
      return r;
    }),
  );
  const rels = await getRelationData();
  await updateExportProgress(1);
  const relations = uniqJsonArray(
    rels.filter((r) => nodeSet.has(r.source) && nodeSet.has(r.target)),
  );
  const relData = relations.map(({ relUid, source, target }) => ({
    // no id yet, just a blank node
    "@type": "relationInstance", // eslint-disable-line @typescript-eslint/naming-convention
    predicate: `pages:${relUid}`,
    source: `pages:${source}`,
    destination: `pages:${target}`,
  }));
  return {
    /* eslint-disable @typescript-eslint/naming-convention */
    "@context": jsonLdContext(roamUrl),
    "@id": roamUrl,
    "prov:generatedAtTime": new Date().toISOString(),
    "@graph": [...schemaData, ...nodes, ...relData],
    /* eslint-enable @typescript-eslint/naming-convention */
  };
};
