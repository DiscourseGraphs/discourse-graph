import React, { useMemo, useState } from "react";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import {
  getPersonalSetting,
  setPersonalSetting,
} from "~/components/settings/utils/accessors";
import {
  PersonalFlagPanel,
  PersonalTextPanel,
} from "./components/BlockPropSettingPanels";

const CANVAS_NODE_SHORTCUTS_KEY = "Canvas node shortcuts";

type ShortcutRowProps = {
  nodeType: string;
  nodeText: string;
  defaultShortcut: string;
};

const ShortcutRow = ({
  nodeType,
  nodeText,
  defaultShortcut,
}: ShortcutRowProps) => {
  const enabledKey = [CANVAS_NODE_SHORTCUTS_KEY, nodeType, "enabled"];
  const valueKey = [CANVAS_NODE_SHORTCUTS_KEY, nodeType, "value"];

  const [enabled, setEnabled] = useState(
    () => getPersonalSetting<boolean>(enabledKey) ?? false,
  );

  const handleEnabledChange = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) setPersonalSetting(valueKey, "");
  };

  // Read on every render so the text panel's remount (key={enabled}) sees the
  // latest stored value after uncheck clears it.
  const storedValue = getPersonalSetting<string>(valueKey) ?? "";
  const inputInitialValue = enabled ? storedValue : "";

  return (
    <div className="flex flex-col gap-1">
      <PersonalFlagPanel
        title={`Use custom ${nodeText} shortcut`}
        description={`Override the canvas keyboard shortcut. Default: ${defaultShortcut || "none"}. Changes take effect next time a canvas is opened.`}
        settingKeys={enabledKey}
        value={enabled}
        onChange={handleEnabledChange}
      />
      <div className="ml-6 max-w-xs">
        <PersonalTextPanel
          key={String(enabled)}
          title=""
          description=""
          settingKeys={valueKey}
          initialValue={inputInitialValue}
          disabled={!enabled}
          placeholder={defaultShortcut || "(no shortcut)"}
        />
      </div>
    </div>
  );
};

const CanvasShortcutSettings = () => {
  const nodes = useMemo(
    () => getDiscourseNodes().filter(excludeDefaultNodes),
    [],
  );

  return (
    <div className="flex flex-col gap-4 p-1">
      {nodes.map((node) => (
        <ShortcutRow
          key={node.type}
          nodeType={node.type}
          nodeText={node.text}
          defaultShortcut={node.shortcut}
        />
      ))}
    </div>
  );
};

export default CanvasShortcutSettings;
