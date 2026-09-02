import getDiscourseNodes, { type DiscourseNode } from "./getDiscourseNodes";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";
import { extractFieldFromTitle } from "./extractContentFromTitle";
import { readImportedSourceIdentity } from "./importedSourceIdentity";
import { isRid } from "@repo/database/lib/rid";

// Temporary hack, until slots are a first-class node type setting: a node type whose
// format has a {source} placeholder (Evidence, among the default node types) is taken
// to have a sourceDocument slot, filled by the Source node named in a node's title.
// Both the sync and the publish path express this, so it lives here rather than in
// either of them.

export const SOURCE_SLOT = "sourceDocument";
const DEFAULT_SOURCE_SCHEMA_ID = "_SRC-node";

type NodeFormat = Pick<DiscourseNode, "format">;

export const schemaHasSourceSlot = (schema: NodeFormat): boolean =>
  (schema?.format ?? "").toLowerCase().includes("{source}");

const sourceNodeType = (allNodes: DiscourseNode[]): DiscourseNode | undefined =>
  allNodes.find((node) => node.text.toLowerCase() === "source");

// The node type a sourceDocument slot points at.
export const sourceSlotSchemaId = (allNodes?: DiscourseNode[]): string =>
  sourceNodeType(allNodes ?? getDiscourseNodes())?.type ??
  DEFAULT_SOURCE_SCHEMA_ID;

// Compiled once per format: these are matched against every node's source.
const formatMatchers = new Map<string, RegExp>();
const matcherFor = (format: string): RegExp => {
  const cached = formatMatchers.get(format);
  if (cached) return cached;
  const matcher = getDiscourseNodeFormatExpression(format);
  formatMatchers.set(format, matcher);
  return matcher;
};

// A slot may only hold a discourse node: the database resolves its value to a concept,
// and a page that is not a discourse node has none, which would be stored as a null
// reference. Better to leave the slot out than to fill it with that.
//
// Which node type it is, we do not check, and that leniency is part of the hack: the
// Source type is recognised here by being named "source", and a graph coming from
// another app may well name it otherwise. Rejecting anything but a local "Source" node
// would silently drop those. This goes away with slots as a real node type setting.
const isDiscourseNodeTitle = (
  title: string,
  allNodes: DiscourseNode[],
): boolean =>
  allNodes
    .filter((n) => n.format !== "{content}") // exclude page and block
    .some((node) => matcherFor(node.format).test(title));

// The page a node's {source} placeholder resolves to, when there is one: its uid, or
// the RID it is known by elsewhere when it was imported from another app. The
// placeholder is usually filled with a page reference, and a title holding a slash is
// a namespaced page rather than a source, so it is left alone.
export const sourceIdOfNode = (
  title: string,
  schema: NodeFormat | undefined,
  allNodes?: DiscourseNode[],
): string | undefined => {
  if (schema === undefined) return undefined;
  if (!schemaHasSourceSlot(schema)) return undefined;
  const sourceTitle = extractFieldFromTitle(title, schema, "source")
    ?.replace(/^\[\[(.*)\]\]$/s, "$1")
    .trim();
  if (!sourceTitle || sourceTitle.includes("/")) return undefined;
  if (!isDiscourseNodeTitle(sourceTitle, allNodes ?? getDiscourseNodes()))
    return undefined;
  const sourceUid = getPageUidByPageTitle(sourceTitle);
  if (!sourceUid) return undefined;
  const sourceRid = readImportedSourceIdentity(sourceUid)?.sourceNodeRid;
  return sourceRid !== undefined && isRid(sourceRid) ? sourceRid : sourceUid;
};
