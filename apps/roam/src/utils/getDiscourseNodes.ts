import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import discourseConfigRef from "./discourseConfigRef";
import getDiscourseRelations from "./getDiscourseRelations";
import { roamNodeToCondition } from "./parseQuery";
import { Condition } from "./types";
import { InputTextNode, RoamBasicNode } from "roamjs-components/types";

export const excludeDefaultNodes = (node: DiscourseNode) => {
  return node.backedBy !== "default";
};

// TODO - only text and type should be required
export type DiscourseNode = {
  text: string;
  type: string;
  shortcut: string;
  tag?: string;
  specification: Condition[];
  backedBy: "user" | "default" | "relation";
  canvasSettings: {
    [k: string]: string;
  };
  // @deprecated - use specification instead
  format: string;
  graphOverview?: boolean;
  description?: string;
  template?: InputTextNode[];
  embeddingRef?: string;
  embeddingRefUid?: string;
  isFirstChild?: {
    uid: string;
    value: boolean;
  };
};

const DEFAULT_NODES: DiscourseNode[] = [
  {
    text: "Page",
    type: "page-node",
    shortcut: "p",
    tag: "",
    format: "{content}",
    specification: [
      {
        type: "clause",
        source: "Page",
        relation: "has title",
        target: "/^(.*)$/",
        uid: window.roamAlphaAPI.util.generateUID(),
      },
    ],
    canvasSettings: { color: "#000000" },
    backedBy: "default",
  },
  {
    text: "Block",
    type: "blck-node",
    shortcut: "b",
    tag: "",
    format: "{content}",
    specification: [
      {
        type: "clause",
        source: "Block",
        relation: "is in page",
        target: "_",
        uid: window.roamAlphaAPI.util.generateUID(),
      },
    ],
    canvasSettings: { color: "#505050" },
    backedBy: "default",
  },
];

const getSpecification = (children: RoamBasicNode[] | undefined) => {
  const spec = getSubTree({
    tree: children,
    key: "specification",
  });
  const scratchNode = getSubTree({ tree: spec.children, key: "scratch" });
  const conditionsNode = getSubTree({
    tree: scratchNode.children,
    key: "conditions",
  });
  const specs = conditionsNode.children.map(roamNodeToCondition);
  return specs;
};

const getUidAndBooleanSetting = ({
  tree,
  text,
}: {
  tree: RoamBasicNode[];
  text: string;
}) => {
  const node = tree.find((t) => t.text === text);
  const value = !!node?.children?.length;
  return {
    uid: node?.uid || "",
    value,
  };
};

const getDiscourseNodes = (relations = getDiscourseRelations()) => {
  const configuredNodes = Object.entries(discourseConfigRef.nodes)
    .map(([type, { text, children }]): DiscourseNode => {
      const suggestiveRules = getSubTree({
        tree: children,
        key: "Suggestive Rules",
      });
      const embeddingBlockRef = getSubTree({
        tree: suggestiveRules.children,
        key: "Embedding Block Ref",
      });

      return {
        format: getSettingValueFromTree({ tree: children, key: "format" }),
        text,
        shortcut: getSettingValueFromTree({ tree: children, key: "shortcut" }),
        tag: getSettingValueFromTree({ tree: children, key: "tag" }),
        type,
        specification: getSpecification(children),
        backedBy: "user",
        canvasSettings: Object.fromEntries(
          getSubTree({ tree: children, key: "canvas" }).children.map(
            (c) => [c.text, c.children[0]?.text || ""] as const,
          ),
        ),
        graphOverview:
          children.filter((c) => c.text === "Graph Overview").length > 0,
        description: getSettingValueFromTree({
          tree: children,
          key: "description",
        }),
        template: getSubTree({ tree: children, key: "template" }).children,
        embeddingRef: embeddingBlockRef?.children?.[0]?.text,
        embeddingRefUid: embeddingBlockRef?.uid,
        isFirstChild: getUidAndBooleanSetting({
          tree: suggestiveRules.children,
          text: "First Child",
        }),
      };
    })
    .concat(
      relations
        .filter((r) => r.triples.some((t) => t.some((n) => /anchor/i.test(n))))
        .map((r) => ({
          format: "",
          text: r.label,
          type: r.id,
          shortcut: r.label.slice(0, 1),
          tag: "",
          specification: r.triples.map(([source, relation, target]) => ({
            type: "clause",
            source: /anchor/i.test(source) ? r.label : source,
            relation,
            target:
              target === "source"
                ? r.source
                : target === "destination"
                  ? r.destination
                  : /anchor/i.test(target)
                    ? r.label
                    : target,
            uid: window.roamAlphaAPI.util.generateUID(),
          })),
          backedBy: "relation",
          canvasSettings: {},
        })),
    );
  const configuredNodeTexts = new Set(configuredNodes.map((n) => n.text));
  const defaultNodes = DEFAULT_NODES.filter(
    (n) => !configuredNodeTexts.has(n.text),
  );
  return configuredNodes.concat(defaultNodes);
};

export default getDiscourseNodes;
