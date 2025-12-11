// To be removed when format is migrated to specification
// https://github.com/RoamJS/query-builder/issues/189

import { PullBlock } from "roamjs-components/types";
import getDiscourseNodes, { DiscourseNode } from "./getDiscourseNodes";
import compileDatalog from "./compileDatalog";
import discourseNodeFormatToDatalog from "./discourseNodeFormatToDatalog";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import { render as renderToast } from "roamjs-components/components/Toast";
import FormDialog from "roamjs-components/components/FormDialog";
import { QBClause, Result } from "./types";
import findDiscourseNode from "./findDiscourseNode";
import extractTag from "roamjs-components/util/extractTag";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import ModifyNodeDialog, {
  ModifyNodeDialogProps,
} from "~/components/ModifyNodeDialog";
import getExtensionAPI from "roamjs-components/util/extensionApiContext";

const renderFormDialog = createOverlayRender<ModifyNodeDialogProps>(
  "form-dialog",
  ModifyNodeDialog,
);

export const getNewDiscourseNodeText = async ({
  text,
  nodeType,
  blockUid,
}: {
  text: string;
  nodeType: string;
  blockUid?: string;
}) => {
  const discourseNodes = getDiscourseNodes();
  let newText = text;
  if (!text) {
    newText = await new Promise<string>((resolve) => {
      renderFormDialog({
        mode: "create",
        nodeType: nodeType,
        initialValue: { text: text, uid: "" },
        onSuccess: async () => {
          return Promise.resolve();
        },
        sourceBlockUid: blockUid,
        extensionAPI: getExtensionAPI(),
        onClose: () => {
          resolve("");
        },
      });
    });
  }

  if (!newText || !newText.trim()) {
    return "";
  }

  const indexedByType = Object.fromEntries(
    discourseNodes.map((mi, i) => [mi.type, mi]),
  );

  const format = indexedByType[nodeType]?.format || "";
  const formattedText = format.replace(/{([\w\d-]*)}/g, (_, val) => {
    if (/content/i.test(val)) return newText;
    const referencedNode = discourseNodes.find(({ text: newText }) =>
      new RegExp(newText, "i").test(val),
    );
    if (referencedNode) {
      const referenced = window.roamAlphaAPI.data.fast.q(
        `[:find (pull ?r [:node/title :block/string]) :where [?b :block/uid "${blockUid}"] (or-join [?b ?r] (and [?b :block/parents ?p] [?p :block/refs ?r]) (and [?b :block/page ?r])) ${discourseNodeFormatToDatalog(
          {
            freeVar: "r",
            ...referencedNode,
          },
        )
          .map((c) => compileDatalog(c, 0))
          .join(" ")}]`,
      )?.[0]?.[0] as PullBlock;
      return referenced?.[":node/title"]
        ? `[[${referenced?.[":node/title"]}]]`
        : referenced?.[":block/string"] || "";
    }
    return "";
  });
  return formattedText;
};

export const getReferencedNodeInFormat = ({
  uid,
  format: providedFormat,
  discourseNodes = getDiscourseNodes(),
}: {
  uid?: string;
  format?: string;
  discourseNodes?: DiscourseNode[];
}) => {
  let format = providedFormat;
  if (!format) {
    const discourseNode = findDiscourseNode({ uid });
    if (discourseNode) format = discourseNode.format;
  }
  if (!format) return null;

  const regex = /{([\w\d-]*)}/g;
  const matches = [...format.matchAll(regex)];

  for (const match of matches) {
    const val = match[1];
    if (val.toLowerCase() === "context") continue;

    const referencedNode = Object.values(discourseNodes).find(({ text }) =>
      new RegExp(text, "i").test(val),
    );

    if (referencedNode) return referencedNode;
  }

  return null;
};

export const findReferencedNodeInText = ({
  text,
  discourseNode,
}: {
  text: string;
  discourseNode: DiscourseNode;
}) => {
  // assumes that the referenced node in format has a specification
  // which includes:
  // has title relation
  // a (.*?) pattern in it's target
  // eg: Source: /^@(.*?)$/

  const specification = discourseNode.specification;
  const titleCondition = specification.find(
    (s): s is QBClause => s.type === "clause" && s.relation === "has title",
  );
  if (!titleCondition) return null;

  // Remove leading and trailing slashes and start/end modifiers
  const patternStr = titleCondition.target.slice(1, -1).replace(/^\^|\$$/g, "");

  // Since we assume there's always a (.*?), we replace it with a specific pattern to capture text within [[ ]]
  // This assumes (.*?) is meant to capture the relevant content
  const modifiedPatternStr = patternStr.replace(/\(\.\*\?\)/, "(.*?)");
  const dynamicPattern = new RegExp(`\\[\\[${modifiedPatternStr}\\]\\]`, "g");
  const match = text.match(dynamicPattern)?.[0] || "";
  if (!match) return null;

  const pageTitle = extractTag(match);
  const uid = getPageUidByPageTitle(pageTitle);

  return {
    uid,
    text: pageTitle,
  } as Result;
};

export const escapeCljString = (str: string) => {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').toLowerCase();
};
