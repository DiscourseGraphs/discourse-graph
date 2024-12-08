import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import type { InputTextNode } from "roamjs-components/types";
import createPage from "roamjs-components/writes/createPage";

const pruneNodes = (nodes: InputTextNode[]): InputTextNode[] =>
  nodes
    .filter((n) => !getPageTitleByPageUid(n.uid || ""))
    .map((n) => ({ ...n, children: pruneNodes(n.children || []) }));

const importDiscourseGraph = ({
  title,
  grammar: _grammar,
  nodes,
  relations,
}: {
  title: string;
  grammar: { source: string; label: string; destination: string }[];
  nodes: InputTextNode[];
  relations: { source: string; label: string; target: string }[];
}) => {
  const pagesByUids = Object.fromEntries(
    nodes.map(({ uid, text }) => [uid, text])
  );
  return createPage({
    title,
    tree: relations.map(({ source, target, label }) => ({
      text: `[[${pagesByUids[source]}]]`,
      children: [
        {
          text: label,
          children: [
            {
              text: `[[${pagesByUids[target]}]]`,
            },
          ],
        },
      ],
    })),
  }).then(() =>
    Promise.all(
      pruneNodes(nodes).map((node) =>
        createPage({ title: node.text, tree: node.children, uid: node.uid })
      )
    )
  );
};

export default importDiscourseGraph;
