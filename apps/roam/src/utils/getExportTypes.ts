import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import { PullBlock, TreeNode } from "roamjs-components/types";
import type { Result } from "roamjs-components/types/query-builder";
import getDiscourseNodes from "./getDiscourseNodes";
import isFlagEnabled from "./isFlagEnabled";
import getDiscourseRelations from "./getDiscourseRelations";
import type { ExportDialogProps } from "~/components/Export";
import getPageMetadata from "./getPageMetadata";
import getDiscourseContextResults from "./getDiscourseContextResults";
import { getRelationDataUtil } from "./getRelationData";
import { ExportTypes } from "./types";
import { getExportSettings } from "./getExportSettings";
import { pageToMarkdown, toMarkdown } from "./pageToMarkdown";
import { getJsonLdData } from "./jsonld";
import {
  uniqJsonArray,
  getPageData,
  getFilename,
  toLink,
  pullBlockToTreeNode,
  collectUids,
} from "./exportUtils";

export const updateExportProgress = (detail: {
  progress: number;
  id: string;
}) =>
  document.body.dispatchEvent?.(
    new CustomEvent("roamjs:export:progress", {
      detail,
    }),
  );

type getExportTypesProps = {
  results?: ExportDialogProps["results"];
  exportId: string;
  isExportDiscourseGraph: boolean;
};

/* eslint-disable @typescript-eslint/naming-convention */
type RoamImportUser = {
  ":user/uid": string;
};

type RoamImportBlock = {
  string: string;
  uid?: string;
  children?: RoamImportBlock[];
  "create-time"?: number;
  "edit-time"?: number;
  "edit-user"?: RoamImportUser;
  heading?: 0 | 1 | 2 | 3;
  "text-align"?: "left" | "center" | "right" | "justify";
};

type RoamImportPage = {
  title: string;
  children?: RoamImportBlock[];
  "create-time"?: number;
  "edit-time"?: number;
  "edit-user"?: RoamImportUser;
};
/* eslint-enable @typescript-eslint/naming-convention */

const getExportTypes = ({
  results,
  exportId,
  isExportDiscourseGraph,
}: getExportTypesProps): ExportTypes => {
  const allRelations = getDiscourseRelations();
  const allNodes = getDiscourseNodes(allRelations);
  const nodeLabelByType = Object.fromEntries(
    allNodes.map((a) => [a.type, a.text]),
  );
  nodeLabelByType["*"] = "Any";

  const getRelationData = () =>
    getRelationDataUtil({ allRelations, nodeLabelByType, local: true });

  const getRoamImportUser = (): RoamImportUser | undefined => {
    const userUid = window.roamAlphaAPI.user.uid();
    if (!userUid) return undefined;
    const user = {} as RoamImportUser;
    user[":user/uid"] = userUid;
    return user;
  };

  const toEpochMilliseconds = (value: Date): number | undefined => {
    const time = value.getTime();
    return Number.isFinite(time) && time > 0 ? time : undefined;
  };

  const toRoamHeading = (heading: number): 0 | 1 | 2 | 3 => {
    if (heading === 1 || heading === 2 || heading === 3) return heading;
    return 0;
  };

  const toRoamImportBlock = (
    node: TreeNode,
    editUser: RoamImportUser | undefined,
  ): RoamImportBlock => {
    const editTime = toEpochMilliseconds(node.editTime);
    const heading = toRoamHeading(node.heading);
    const children = node.children.map((child) =>
      toRoamImportBlock(child, editUser),
    );

    const block: RoamImportBlock = {
      string: node.text,
      uid: node.uid || undefined,
      children: children.length ? children : undefined,
      heading: heading || undefined,
    };
    block["create-time"] = editTime;
    block["edit-time"] = editTime;
    block["edit-user"] = editUser;
    block["text-align"] = node.textAlign || undefined;
    return block;
  };

  const getJsonData = async (results: Result[]) => {
    const grammar = allRelations.map(({ label, destination, source }) => ({
      label,
      destination: nodeLabelByType[destination],
      source: nodeLabelByType[source],
    }));
    const nodes = getPageData({ results, allNodes }).map(({ text, uid }) => {
      const { date, displayName } = getPageMetadata(text);
      const { children } = getFullTreeByParentUid(uid);
      return {
        uid,
        title: text,
        children,
        date: date.toJSON(),
        createdBy: displayName,
      };
    });
    const nodeSet = new Set(nodes.map((n) => n.uid));
    return getRelationData().then((rels) => {
      const relations = uniqJsonArray(
        rels.filter((r) => nodeSet.has(r.source) && nodeSet.has(r.target)),
      );
      return { grammar, nodes, relations };
    });
  };

  const getRoamImportData = (results: Result[]): RoamImportPage[] => {
    const editUser = getRoamImportUser();
    return getPageData({ results, allNodes, isExportDiscourseGraph }).map(
      ({ text, uid }) => {
        const { children } = getFullTreeByParentUid(uid);
        const { date, modified } = getPageMetadata(text);
        const createTime = toEpochMilliseconds(date);
        const editTime = toEpochMilliseconds(modified);

        const page: RoamImportPage = {
          title: text,
          children: children.map((node) => toRoamImportBlock(node, editUser)),
        };
        page["create-time"] = createTime;
        page["edit-time"] = editTime || createTime;
        page["edit-user"] = editUser;
        return page;
      },
    );
  };

  return [
    {
      name: "Markdown",
      callback: async ({ includeDiscourseContext = false }) => {
        if (!results) return [];
        const settings = {
          ...getExportSettings(),
          includeDiscourseContext,
        };
        const {
          simplifiedFilename,
          maxFilenameLength,
          removeSpecialCharacters,
        } = settings;
        const allPages = getPageData({
          results,
          allNodes,
          isExportDiscourseGraph,
        });
        const gatherings = allPages.map((result, i, all) => async () => {
          updateExportProgress({ progress: i / all.length, id: exportId });
          // skip a beat to let progress render
          await new Promise((resolve) => setTimeout(resolve));
          return pageToMarkdown(result, {
            ...settings,
            allNodes,
          });
        });

        const pages = await gatherings.reduce(
          (p, c) =>
            p.then((arr) =>
              c().then((item) => {
                arr.push(item);
                return arr;
              }),
            ),
          Promise.resolve(
            [] as Awaited<ReturnType<(typeof gatherings)[number]>>[],
          ),
        );
        return pages.map(({ title, content }) => ({
          title: getFilename({
            title,
            maxFilenameLength,
            simplifiedFilename,
            allNodes,
            removeSpecialCharacters,
          }),
          content,
        }));
      },
    },
    {
      name: "JSON",
      callback: async ({ filename }) => {
        if (!results) return [];
        const data = await getJsonData(results);
        return [
          {
            title: `${filename.replace(/\.json$/, "")}.json`,
            content: JSON.stringify(data),
          },
        ];
      },
    },
    {
      name: "Roam Import JSON",
      callback: ({ filename }) => {
        if (!results) return Promise.resolve([]);
        const data = getRoamImportData(results);
        return Promise.resolve([
          {
            title: `${filename.replace(/\.json$/, "")}.json`,
            content: JSON.stringify(data, undefined, 2),
          },
        ]);
      },
    },
    {
      name: "JSON-LD (Experimental)",
      callback: async ({ filename }) => {
        if (!results) return [];
        const data = await getJsonLdData({
          results,
          allNodes,
          allRelations,
          nodeLabelByType,
          updateExportProgress: async (progress: number) => {
            updateExportProgress({ progress, id: exportId });
            // skip a beat to let progress render
            await new Promise((resolve) => setTimeout(resolve));
          },
        });
        return [
          {
            title: `${filename.replace(/\.json$/, "")}.json`,
            content: JSON.stringify(data, undefined, "  "),
          },
        ];
      },
    },
    {
      name: "Neo4j",
      callback: async ({ filename }) => {
        if (!results) return [];
        const nodeHeader = "uid:ID,label:LABEL,title,author,date\n";
        const nodeData = getPageData({ results, allNodes })
          .map(({ text, uid, type }) => {
            const value = text.replace(new RegExp(`^\\[\\[\\w*\\]\\] - `), "");
            const { displayName, date } = getPageMetadata(text);
            return `${uid},${type.toUpperCase()},${
              value.includes(",") ? `"${value}"` : value
            },${displayName},"${date.toLocaleString()}"`;
          })
          .join("\n");
        const relationHeader = "start:START_ID,end:END_ID,label:TYPE\n";
        return getRelationData().then((rels) => {
          const relationData = rels.map(
            ({ source, target, label }) =>
              `${source},${target},${label.toUpperCase()}`,
          );
          const relations = relationData.join("\n");
          return [
            {
              title: `${filename.replace(/\.csv/, "")}_nodes.csv`,
              content: `${nodeHeader}${nodeData}`,
            },
            {
              title: `${filename.replace(/\.csv/, "")}_relations.csv`,
              content: `${relationHeader}${relations}`,
            },
          ];
        });
      },
    },
    {
      name: "CSV",
      callback: async ({ filename }) => {
        if (!results) return [];
        const keys = Object.keys(results[0]).filter((u) => !/uid/i.test(u));
        const header = `${keys.join(",")}\n`;
        const data = results
          .map((r) =>
            keys
              .map((k) => r[k].toString())
              .map((v) => (v.includes(",") ? `"${v}"` : v)),
          )
          .join("\n");
        return [
          {
            title: `${filename.replace(/\.csv/, "")}.csv`,
            content: `${header}${data}`,
          },
        ];
      },
    },
    {
      name: "PDF",
      callback: async ({ includeDiscourseContext = false }) => {
        if (!results) return [];
        const {
          optsRefs,
          optsEmbeds,
          simplifiedFilename,
          maxFilenameLength,
          removeSpecialCharacters,
          linkType,
        } = getExportSettings();
        const allPages = getPageData({
          results,
          allNodes,
          isExportDiscourseGraph,
        });
        const gatherings = allPages.map(({ text, uid }, i, all) => async () => {
          updateExportProgress({ progress: i / all.length, id: exportId });
          // skip a beat to let progress render
          await new Promise((resolve) => setTimeout(resolve));

          // TODO - resuse these with the markdown export
          const treeNodeToMarkdown = (c: TreeNode) => {
            return toMarkdown({
              c,
              v: "document",
              i: 0,
              opts: {
                refs: optsRefs,
                embeds: optsEmbeds,
                simplifiedFilename,
                allNodes,
                maxFilenameLength,
                removeSpecialCharacters,
                linkType,
                flatten: true,
              },
            });
          };
          const treeNode = getFullTreeByParentUid(uid);
          const getMarkdownContent = () => {
            return treeNode.children.map(treeNodeToMarkdown).join("\n");
          };
          const getDiscourseResultsContent = async () => {
            const discourseResults = includeDiscourseContext
              ? await getDiscourseContextResults({
                  uid,
                })
              : [];
            if (discourseResults.length === 0) return "";

            const formattedResults = discourseResults
              .flatMap((r) =>
                Object.values(r.results).map((t) => {
                  const filename = getFilename({
                    title: t.text,
                    maxFilenameLength,
                    simplifiedFilename,
                    allNodes,
                    removeSpecialCharacters,
                  });
                  const uid = t.uid || "";
                  const link = toLink(filename, uid, linkType);
                  return `**${r.label}::** ${link}`;
                }),
              )
              .join("\n");

            return `### Discourse context\n\n${formattedResults}`;
          };
          const getReferenceResultsContent = async () => {
            const normalizedTitle = normalizePageTitle(text);
            const flag = isFlagEnabled("render references");
            const referenceResults = flag
              ? (
                  window.roamAlphaAPI.data.fast.q(
                    `[:find (pull ?pr [:node/title])
                        (pull ?r
                          [:block/heading [:block/string :as "text"]
                          [:children/view-type :as "viewType"]
                          {:block/children ...}])
                        :where
                          [?p :node/title "${normalizedTitle}"]
                          [?r :block/refs ?p]
                          [?r :block/page ?pr]]`,
                  ) as [PullBlock, PullBlock][]
                ).filter(
                  ([, { [":block/children"]: children }]) =>
                    Array.isArray(children) && children.length,
                )
              : [];
            if (referenceResults.length === 0) return "";

            const refResultsMarkdown = referenceResults
              .map((r) => {
                const filename = getFilename({
                  title: r[0][":node/title"],
                  maxFilenameLength,
                  simplifiedFilename,
                  allNodes,
                  removeSpecialCharacters,
                });
                const uid = r[0][":block/uid"] || "";
                const link = toLink(filename, uid, linkType);
                const node = treeNodeToMarkdown(
                  pullBlockToTreeNode(r[1], ":bullet"),
                );
                return `${link}${node}`;
              })
              .join("\n");

            return `### References\n\n${refResultsMarkdown}`;
          };

          const markdownContent = getMarkdownContent();
          const discourseResults = await getDiscourseResultsContent();
          const referenceResults = await getReferenceResultsContent();
          const contentParts = [
            markdownContent,
            discourseResults,
            referenceResults,
          ];
          const content = contentParts.filter((part) => part).join("\n\n");
          const uids = new Set(collectUids(treeNode));

          return { title: text, content, uids };
        });
        const pages = await gatherings.reduce(
          (p, c) =>
            p.then((arr) =>
              c().then((item) => {
                arr.push(item);
                return arr;
              }),
            ),
          Promise.resolve(
            [] as Awaited<ReturnType<(typeof gatherings)[number]>>[],
          ),
        );

        return pages.map(({ title, content }) => ({
          title: getFilename({
            title,
            maxFilenameLength,
            simplifiedFilename,
            allNodes,
            removeSpecialCharacters,
            extension: ".pdf",
          }),
          content,
        }));
      },
    },
  ];
};

export default getExportTypes;
