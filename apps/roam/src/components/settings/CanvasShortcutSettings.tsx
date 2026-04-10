import React, { useMemo } from "react";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import { getPersonalSetting } from "~/components/settings/utils/accessors";
import { PersonalTextPanel } from "./components/BlockPropSettingPanels";

const CANVAS_NODE_SHORTCUTS_KEY = "Canvas node shortcuts";

const CanvasShortcutSettings = () => {
  const nodes = useMemo(
    () => getDiscourseNodes().filter(excludeDefaultNodes),
    [],
  );

  return (
    <div className="flex flex-col gap-4 p-1">
      {nodes.map((node) => (
        <PersonalTextPanel
          key={node.type}
          title={node.text}
          description={`Default: ${node.shortcut || "none"}. Changes take effect next time a canvas is opened.`}
          settingKeys={[CANVAS_NODE_SHORTCUTS_KEY, node.type]}
          initialValue={
            getPersonalSetting<string>([
              CANVAS_NODE_SHORTCUTS_KEY,
              node.type,
            ]) || node.shortcut
          }
          placeholder={node.shortcut}
        />
      ))}
    </div>
  );
};

export default CanvasShortcutSettings;
