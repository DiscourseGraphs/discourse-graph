import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import getDiscourseNodes from "./getDiscourseNodes";
import { getPlainTitleFromSpecification } from "./getPlainTitleFromSpecification";

type SigmaRenderer = {
  setSetting: (settingName: string, value: any) => void;
  getSetting: (settingName: string) => any;
};
type nodeData = {
  x: number;
  y: number;
  label: string;
  size: number;
};

export const addGraphViewNodeStyling = () => {
  window.roamAlphaAPI.ui.graphView.wholeGraph.addCallback({
    label: "discourse-node-styling",
    callback: ({ "sigma-renderer": sigma }) => {
      const sig = sigma as SigmaRenderer;
      graphViewNodeStyling({ sig });
    },
  });
};

const graphViewNodeStyling = ({ sig }: { sig: SigmaRenderer }) => {
  const allNodes = getDiscourseNodes();
  const prefixColors = allNodes.map((n) => {
    const formattedTitle = getPlainTitleFromSpecification({
      specification: n.specification,
      text: n.text,
    });
    const formattedBackgroundColor = formatHexColor(n.canvasSettings.color);

    return {
      prefix: formattedTitle,
      color: formattedBackgroundColor,
      showInGraphOverview: n.graphOverview,
    };
  });

  const originalReducer = sig.getSetting("nodeReducer");
  sig.setSetting("nodeReducer", (id: string, nodeData: nodeData) => {
    let modifiedData = originalReducer
      ? originalReducer(id, nodeData)
      : nodeData;

    const { label } = modifiedData;

    for (const { prefix, color, showInGraphOverview } of prefixColors) {
      if (prefix && showInGraphOverview && label.startsWith(prefix)) {
        return {
          ...modifiedData,
          color,
        };
      }
    }

    return modifiedData;
  });
};
