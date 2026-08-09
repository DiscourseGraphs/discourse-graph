import createPage from "roamjs-components/writes/createPage";
import setBlockProps from "~/utils/setBlockProps";
import { DiscourseNodeSchema } from "~/components/settings/utils/zodSchema";
import { invalidateDiscourseNodeTypeCaches } from "~/utils/discourseNodeTypeCache";
import getDiscourseNodes from "./getDiscourseNodes";

export const createDiscourseNodeSchema = async (
  label: string,
  options?: {
    shortcut?: string;
    format?: string;
    template?: string;
  },
): Promise<string> => {
  let { shortcut, format } = options ?? {};
  const { template } = options ?? {};
  if (shortcut === undefined) {
    const candidateShortcut = label.slice(0, 1).toUpperCase();
    const existingShortcuts = new Set(
      getDiscourseNodes()
        .map((n) => n.shortcut.toUpperCase())
        .filter(Boolean),
    );
    shortcut = existingShortcuts.has(candidateShortcut)
      ? ""
      : candidateShortcut;
  }
  format = format ?? `[[${label.slice(0, 3).toUpperCase()}]] - {content}`;
  const tree = [
    {
      text: "Shortcut",
      children: [{ text: shortcut }],
    },
    {
      text: "Tag",
      children: [{ text: "" }],
    },
    {
      text: "Format",
      children: [{ text: format }],
    },
  ];
  if (template != undefined) {
    // TODO: Make into a tree
    tree.push({
      text: "Template",
      children: [{ text: template ?? "" }],
    });
  }
  const valueUid = await createPage({
    title: `discourse-graph/nodes/${label}`,
    tree,
  });
  setBlockProps(
    valueUid,
    DiscourseNodeSchema.parse({
      text: label,
      type: valueUid,
      shortcut,
      format,
    }),
  );
  invalidateDiscourseNodeTypeCaches();
  return valueUid;
};
