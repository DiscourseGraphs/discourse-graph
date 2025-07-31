import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { createPage } from "roamjs-components/writes";
import INITIAL_NODE_VALUES from "~/data/defaultDiscourseNodes";
import getDiscourseNodes, { excludeDefaultNodes } from "./getDiscourseNodes";

const initializeDiscourseNodes = async () => {
  const nodes = getDiscourseNodes().filter(excludeDefaultNodes);
  if (nodes.length === 0) {
    await Promise.all(
      INITIAL_NODE_VALUES.map(
        (n) =>
          getPageUidByPageTitle(`discourse-graph/nodes/${n.text}`) ||
          createPage({
            title: `discourse-graph/nodes/${n.text}`,
            uid: n.type,
            tree: [
              { text: "Format", children: [{ text: n.format || "" }] },
              { text: "Shortcut", children: [{ text: n.shortcut || "" }] },
              { text: "Tag", children: [{ text: n.tag || "" }] },
              { text: "Graph Overview" },
              {
                text: "Canvas",
                children: [
                  {
                    text: "color",
                    children: [{ text: n.canvasSettings?.color || "" }],
                  },
                ],
              },
            ],
          }),
      ),
    );
  }
};

export default initializeDiscourseNodes;
