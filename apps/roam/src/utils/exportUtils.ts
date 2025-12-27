import type { Result } from "roamjs-components/types/query-builder";
import { PullBlock, TreeNode, ViewType } from "roamjs-components/types";
import type { DiscourseNode } from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";

type DiscourseExportResult = Result & { type: string };

export const uniqJsonArray = <T extends Record<string, unknown>>(arr: T[]) =>
  Array.from(
    new Set(
      arr.map((r) =>
        JSON.stringify(
          Object.entries(r).sort(([k], [k2]) => k.localeCompare(k2)),
        ),
      ),
    ),
  ).map((entries) => Object.fromEntries(JSON.parse(entries))) as T[];

export const getPageData = ({
  results,
  allNodes,
  isExportDiscourseGraph,
}: {
  results: Result[];
  allNodes: DiscourseNode[];
  isExportDiscourseGraph?: boolean;
}): (Result & { type: string })[] => {
  if (isExportDiscourseGraph) return results as DiscourseExportResult[];

  const matchedTexts = new Set();
  const mappedResults = results.flatMap((r) =>
    Object.keys(r)
      .filter((k) => k.endsWith(`-uid`) && k !== "text-uid")
      .map((k) => ({
        ...r,
        text: r[k.slice(0, -4)].toString(),
        uid: r[k] as string,
      }))
      .concat({
        text: r.text,
        uid: r.uid,
      }),
  );
  return allNodes.flatMap((n) =>
    mappedResults
      .filter(({ text }) => {
        if (!text) return false;
        if (matchedTexts.has(text)) return false;
        const isMatch = matchDiscourseNode({ title: text, ...n });
        if (isMatch) matchedTexts.add(text);

        return isMatch;
      })
      .map((node) => ({ ...node, type: n.text })),
  );
};

const getContentFromNodes = ({
  title,
  allNodes,
}: {
  title: string;
  allNodes: DiscourseNode[];
}) => {
  const nodeFormat = allNodes.find((a) =>
    matchDiscourseNode({ title, ...a }),
  )?.format;
  if (!nodeFormat) return title;
  const regex = new RegExp(
    `^${nodeFormat
      .replace(/[[\]\\^$.|?*+()]/g, "\\$&")
      .replace("{content}", "(.*?)")
      .replace(/{[^}]+}/g, "(?:.*?)")}$`,
  );
  return regex.exec(title)?.[1] || title;
};

export const getFilename = ({
  title = "",
  maxFilenameLength,
  simplifiedFilename,
  allNodes,
  removeSpecialCharacters,
  extension = ".md",
}: {
  title?: string;
  maxFilenameLength: number;
  simplifiedFilename: boolean;
  allNodes: DiscourseNode[];
  removeSpecialCharacters: boolean;
  extension?: string;
}) => {
  const baseName = simplifiedFilename
    ? getContentFromNodes({ title, allNodes })
    : title;
  const name = `${
    removeSpecialCharacters
      ? baseName.replace(/[<>:"/\\|\?*[\]]/g, "")
      : baseName
  }${extension}`;

  return name.length > maxFilenameLength
    ? `${name.substring(
        0,
        Math.ceil((maxFilenameLength - 3) / 2),
      )}...${name.slice(-Math.floor((maxFilenameLength - 3) / 2))}`
    : name;
};

export const toLink = (filename: string, uid: string, linkType: string) => {
  const extensionRemoved = filename.replace(/\.\w+$/, "");
  if (linkType === "wikilinks") return `[[${extensionRemoved}]]`;
  if (linkType === "alias") return `[${filename}](${filename})`;
  if (linkType === "roam url")
    return `[${extensionRemoved}](https://roamresearch.com/#/app/${window.roamAlphaAPI.graph.name}/page/${uid})`;
  return filename;
};

export const pullBlockToTreeNode = (
  n: PullBlock,
  v: `:${ViewType}`,
): TreeNode => ({
  text: n[":block/string"] || n[":node/title"] || "",
  open: typeof n[":block/open"] === "undefined" ? true : n[":block/open"],
  order: n[":block/order"] || 0,
  uid: n[":block/uid"] || "",
  heading: n[":block/heading"] || 0,
  viewType: (n[":children/view-type"] || v).slice(1) as ViewType,
  editTime: new Date(n[":edit/time"] || 0),
  props: { imageResize: {}, iframe: {} },
  textAlign: n[":block/text-align"] || "left",
  children: (n[":block/children"] || [])
    .sort(({ [":block/order"]: a = 0 }, { [":block/order"]: b = 0 }) => a - b)
    .map((r) => pullBlockToTreeNode(r, n[":children/view-type"] || v)),
  parents: (n[":block/parents"] || []).map((p) => p[":db/id"] || 0),
});

export const collectUids = (t: TreeNode): string[] => [
  t.uid,
  ...t.children.flatMap(collectUids),
];
