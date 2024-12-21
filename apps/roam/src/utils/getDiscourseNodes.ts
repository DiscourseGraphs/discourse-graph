import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import discourseConfigRef from "./discourseConfigRef";
import getDiscourseRelations from "./getDiscourseRelations";
import parseQuery from "./parseQuery";
import { Condition } from "./types";
import { InputTextNode } from "roamjs-components/types";

export const excludeDefaultNodes = (node: DiscourseNode) => {
  return node.backedBy !== "default";
};

// TODO - only text and type should be required
export type DiscourseNode = {
  text: string;
  type: string;
  shortcut: string;
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
};

const DEFAULT_NODES: DiscourseNode[] = [
  {
    text: "Page",
    type: "page-node",
    shortcut: "p",
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

const getDiscourseNodes = (relations = getDiscourseRelations()) => {
  const configuredNodes = Object.entries(discourseConfigRef.nodes)
    .map(([type, { text, children }]): DiscourseNode => {
      const spec = getSubTree({
        tree: children,
        key: "specification",
      });
      const specTree = spec.children;
      return {
        format: getSettingValueFromTree({ tree: children, key: "format" }),
        text,
        shortcut: getSettingValueFromTree({ tree: children, key: "shortcut" }),
        type,
        specification: !!getSubTree({ tree: specTree, key: "enabled" }).uid
          ? parseQuery(spec.uid).conditions
          : [],
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
