import React, { useState } from "react";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import { setPersonalSetting } from "~/components/settings/utils/accessors";
import { getSetting, setSetting } from "~/utils/extensionSettings";
import { CANVAS_NODE_SHORTCUTS_KEY } from "~/data/userSettings";
import type { CanvasNodeShortcuts } from "./utils/zodSchema";
import {
  PersonalFlagPanel,
  PersonalTextPanel,
} from "./components/BlockPropSettingPanels";

const BLOCK_PROP_KEY = "Canvas node shortcuts";

type ShortcutRowProps = {
  nodeType: string;
  nodeText: string;
  defaultShortcut: string;
  initialEnabled: boolean;
  initialValue: string;
  onEnabledChange: (enabled: boolean) => void;
  onValueChange: (value: string) => void;
};

const ShortcutRow = ({
  nodeType,
  nodeText,
  defaultShortcut,
  initialEnabled,
  initialValue,
  onEnabledChange,
  onValueChange,
}: ShortcutRowProps) => {
  const enabledKey = [BLOCK_PROP_KEY, nodeType, "enabled"];
  const valueKey = [BLOCK_PROP_KEY, nodeType, "value"];

  const [enabled, setEnabled] = useState(initialEnabled);
  const [storedValue, setStoredValue] = useState(initialValue);

  const handleEnabledChange = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      setStoredValue("");
      setPersonalSetting(valueKey, "");
    }
    onEnabledChange(checked);
  };

  const handleValueChange = (value: string) => {
    setStoredValue(value);
    onValueChange(value);
  };

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
          initialValue={storedValue}
          disabled={!enabled}
          placeholder={defaultShortcut || "(no shortcut)"}
          onChange={handleValueChange}
        />
      </div>
    </div>
  );
};

const CanvasShortcutSettings = () => {
  const nodes = getDiscourseNodes().filter(excludeDefaultNodes);
  const [shortcuts, setShortcuts] = useState<CanvasNodeShortcuts>(() =>
    getSetting<CanvasNodeShortcuts>(CANVAS_NODE_SHORTCUTS_KEY, {}),
  );

  const updateShortcut = (
    nodeType: string,
    update: Partial<CanvasNodeShortcuts[string]>,
  ) => {
    const current = shortcuts[nodeType] ?? { value: "", enabled: false };
    const next = { ...shortcuts, [nodeType]: { ...current, ...update } };
    void setSetting(CANVAS_NODE_SHORTCUTS_KEY, next);
    setShortcuts(next);
  };

  return (
    <div className="flex flex-col gap-4 p-1">
      {nodes.map((node) => {
        const override = shortcuts[node.type];
        return (
          <ShortcutRow
            key={node.type}
            nodeType={node.type}
            nodeText={node.text}
            defaultShortcut={node.shortcut}
            initialEnabled={override?.enabled ?? false}
            initialValue={override?.value ?? ""}
            onEnabledChange={(enabled) =>
              updateShortcut(node.type, {
                enabled,
                ...(enabled ? {} : { value: "" }),
              })
            }
            onValueChange={(value) => updateShortcut(node.type, { value })}
          />
        );
      })}
    </div>
  );
};

export default CanvasShortcutSettings;
