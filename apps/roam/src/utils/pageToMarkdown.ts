import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getPageMetadata from "./getPageMetadata";
import getPageViewType from "roamjs-components/queries/getPageViewType";
import type { Result } from "roamjs-components/types/query-builder";
import type { DiscourseNode } from "./getDiscourseNodes";
import type { PullBlock, TreeNode, ViewType } from "roamjs-components/types";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getDiscourseContextResults from "./getDiscourseContextResults";
import isFlagEnabled from "./isFlagEnabled";
import XRegExp from "xregexp";
import {
  findReferencedNodeInText,
  getReferencedNodeInFormat,
} from "./formatUtils";
import {
  getFilename,
  toLink,
  pullBlockToTreeNode,
  collectUids,
} from "./exportUtils";

const MATCHES_NONE = /$.+^/;

// Roam embed syntax: {{[[embed]]: ((block-uid)) }}
// Roam embed syntax: {{[[embed-path]]: ((block-uid)) }}
// Also handles multiple parentheses: {{[[embed]]: ((((block-uid)))) }}
const EMBED_REGEX =
  /{{\[\[(?:embed|embed-path)\]\]:\s*\(\(+\s*([\w\d-]{9,10})\s*\)\)+\s*}}/;

// Roam embed-children syntax: {{[[embed-children]]: ((block-uid)) }}
const EMBED_CHILDREN_REGEX =
  /{{\[\[embed-children\]\]:\s*\(\(+\s*([\w\d-]{9,10})\s*\)\)+\s*}}/;

const viewTypeToPrefix = {
  bullet: "- ",
  document: "",
  numbered: "1. ",
};

const handleDiscourseContext = async ({
  includeDiscourseContext,
  uid,
  pageTitle,
  appendRefNodeContext,
}: {
  includeDiscourseContext: boolean;
  uid: string;
  pageTitle: string;
  appendRefNodeContext: boolean;
}) => {
  if (!includeDiscourseContext) return [];

  const discourseResults = await getDiscourseContextResults({
    uid,
  });
  if (!appendRefNodeContext) return discourseResults;

  const referencedDiscourseNode = getReferencedNodeInFormat({ uid });
  if (referencedDiscourseNode) {
    const referencedResult = findReferencedNodeInText({
      text: pageTitle,
      discourseNode: referencedDiscourseNode,
    });
    if (!referencedResult) return discourseResults;
    const appendedContext = {
      label: referencedDiscourseNode.text,
      results: { [referencedResult.uid]: referencedResult },
    };
    return [...discourseResults, appendedContext];
  }

  return discourseResults;
};

const handleFrontmatter = ({
  frontmatter,
  rest,
  result,
}: {
  frontmatter: string[];
  rest: Record<string, unknown>;
  result: Result;
}) => {
  const yaml = frontmatter.length
    ? frontmatter
    : [
        "title: {text}",
        `url: https://roamresearch.com/#/app/${window.roamAlphaAPI.graph.name}/page/{uid}`,
        `author: {author}`,
        "date: {date}",
      ];
  const resultCols = Object.keys(rest).filter((k) => !k.includes("uid"));
  const yamlLines = yaml.concat(resultCols.map((k) => `${k}: {${k}}`));
  const content = yamlLines
    .map((s) =>
      s.replace(/{([^}]+)}/g, (_, capt: string) => {
        if (capt === "text") {
          // Wrap title in quotes and escape additional quotes
          const escapedText = result[capt].toString().replace(/"/g, '\\"');
          return `"${escapedText}"`;
        }
        return result[capt].toString();
      }),
    )
    .join("\n");
  const output = `---\n${content}\n---`;
  return output;
};

export const toMarkdown = ({
  c,
  i = 0,
  v = "bullet",
  opts,
}: {
  c: TreeNode;
  i?: number;
  v?: ViewType;
  opts: {
    refs: boolean;
    embeds: boolean;
    simplifiedFilename: boolean;
    maxFilenameLength: number;
    allNodes: DiscourseNode[];
    removeSpecialCharacters: boolean;
    linkType: string;
    flatten?: boolean;
  };
}): string => {
  const {
    refs,
    embeds,
    simplifiedFilename,
    maxFilenameLength,
    allNodes,
    removeSpecialCharacters,
    linkType,
    flatten = false,
  } = opts;
  const processedText = c.text
    .replace(embeds ? EMBED_REGEX : MATCHES_NONE, (_, blockUid: string) => {
      const reference = getFullTreeByParentUid(blockUid);
      return toMarkdown({ c: reference, i, v, opts });
    })
    .replace(
      embeds ? EMBED_CHILDREN_REGEX : MATCHES_NONE,
      (_, blockUid: string) => {
        const reference = getFullTreeByParentUid(blockUid);
        return reference.children
          .map((child) => toMarkdown({ c: child, i, v, opts }))
          .join("\n");
      },
    )
    .replace(refs ? BLOCK_REF_REGEX : MATCHES_NONE, (_, blockUid: string) => {
      const reference = getTextByBlockUid(blockUid);
      return reference || blockUid;
    })
    .replace(/{{\[\[TODO\]\]}}/g, v === "bullet" ? "[ ]" : "- [ ]")
    .replace(/{{\[\[DONE\]\]}}/g, v === "bullet" ? "[x]" : "- [x]")
    .replace(/\_\_(.+?)\_\_/g, "_$1_") // convert Roam italics __ to markdown italics _
    .replace(/(?<!\n)```/g, "\n```") // Add line break before last code blocks
    .trim();
  const finalProcessedText =
    simplifiedFilename || removeSpecialCharacters
      ? XRegExp.matchRecursive(processedText, "#?\\[\\[", "\\]\\]", "i", {
          valueNames: ["between", "left", "match", "right"],
          unbalanced: "skip",
        })
          .map((s) => {
            if (s.name === "match") {
              const name = getFilename({
                title: s.value,
                allNodes,
                maxFilenameLength,
                simplifiedFilename,
                removeSpecialCharacters,
              });
              return toLink(name, c.uid, linkType);
            } else if (s.name === "left" || s.name === "right") {
              return "";
            } else {
              return s.value;
            }
          })
          .join("") || processedText
      : processedText;
  const indentation = flatten ? "" : "".padStart(i * 4, " ");
  // If this block contains an embed, treat it as document to avoid extra prefixes
  const effectiveViewType =
    embeds && (EMBED_REGEX.test(c.text) || EMBED_CHILDREN_REGEX.test(c.text))
      ? "document"
      : v;
  const viewTypePrefix = viewTypeToPrefix[effectiveViewType];
  const headingPrefix = c.heading ? `${"".padStart(c.heading, "#")} ` : "";
  const childrenMarkdown = (c.children || [])
    .filter((nested) => !!nested.text || !!nested.children?.length)
    .map((nested) => {
      const childViewType = v !== "bullet" ? v : nested.viewType || "bullet";
      const childMarkdown = toMarkdown({
        c: nested,
        i: i + 1,
        v: childViewType,
        opts,
      });
      return `\n${childMarkdown}`;
    })
    .join("");
  const lineBreak = v === "document" ? "\n" : "";

  return `${indentation}${viewTypePrefix}${headingPrefix}${finalProcessedText}${lineBreak}${childrenMarkdown}`;
};

export const pageToMarkdown = async (
  { text, uid, context: _, type, ...rest }: Result,
  {
    includeDiscourseContext,
    appendRefNodeContext,
    frontmatter,
    optsRefs,
    optsEmbeds,
    simplifiedFilename,
    allNodes,
    maxFilenameLength,
    removeSpecialCharacters,
    linkType,
  }: {
    includeDiscourseContext: boolean;
    appendRefNodeContext: boolean;
    frontmatter: string[];
    optsRefs: boolean;
    optsEmbeds: boolean;
    simplifiedFilename: boolean;
    allNodes: DiscourseNode[];
    maxFilenameLength: number;
    removeSpecialCharacters: boolean;
    linkType: string;
  },
): Promise<{ title: string; content: string; uids: Set<string> }> => {
  const v = getPageViewType(text) || "bullet";
  const { date, displayName } = getPageMetadata(text);
  const treeNode = getFullTreeByParentUid(uid);

  const discourseResults = await handleDiscourseContext({
    includeDiscourseContext,
    pageTitle: text,
    uid,
    appendRefNodeContext,
  });

  const referenceResults = isFlagEnabled("render references")
    ? (
        window.roamAlphaAPI.data.fast.q(
          `[:find (pull ?pr [:node/title]) (pull ?r [:block/heading [:block/string :as "text"] [:children/view-type :as "viewType"] {:block/children ...}]) :where [?p :node/title "${normalizePageTitle(
            text,
          )}"] [?r :block/refs ?p] [?r :block/page ?pr]]`,
        ) as [PullBlock, PullBlock][]
      ).filter(
        ([, { [":block/children"]: children }]) =>
          Array.isArray(children) && children.length,
      )
    : [];

  const result: Result = {
    ...rest,
    date,
    text,
    uid,
    author: displayName,
    type,
  };
  const yamlLines = handleFrontmatter({
    frontmatter,
    rest,
    result,
  });

  const content = `${yamlLines}\n\n${treeNode.children
    .map((c) =>
      toMarkdown({
        c,
        v,
        i: 0,
        opts: {
          refs: optsRefs,
          embeds: optsEmbeds,
          simplifiedFilename,
          allNodes,
          maxFilenameLength,
          removeSpecialCharacters,
          linkType,
        },
      }),
    )
    .join("\n")}\n${
    discourseResults.length
      ? `\n###### Discourse Context\n\n${discourseResults
          .flatMap((r) =>
            Object.values(r.results).map(
              (t) =>
                `- **${r.label}::** ${toLink(
                  getFilename({
                    title: t.text,
                    maxFilenameLength,
                    simplifiedFilename,
                    allNodes,
                    removeSpecialCharacters,
                  }),
                  t.uid,
                  linkType,
                )}`,
            ),
          )
          .join("\n")}\n`
      : ""
  }${
    referenceResults.length
      ? `\n###### References\n\n${referenceResults
          .map(
            (r_1) =>
              `${toLink(
                getFilename({
                  title: r_1[0][":node/title"],
                  maxFilenameLength,
                  simplifiedFilename,
                  allNodes,
                  removeSpecialCharacters,
                }),
                r_1[0][":block/uid"] || "",
                linkType,
              )}\n\n${toMarkdown({
                c: pullBlockToTreeNode(r_1[1], ":bullet"),
                opts: {
                  refs: optsRefs,
                  embeds: optsEmbeds,
                  simplifiedFilename,
                  allNodes,
                  maxFilenameLength,
                  removeSpecialCharacters,
                  linkType,
                },
              })}`,
          )
          .join("\n")}\n`
      : ""
  }`;
  const uids = new Set(collectUids(treeNode));
  return { title: text, content, uids };
};
