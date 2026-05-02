import React, { useState } from "react";
import { Checkbox, InputGroup, Tabs, Tab } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import { setPersonalSetting } from "~/components/settings/utils/accessors";
import { getSetting, setSetting } from "~/utils/extensionSettings";
import { CANVAS_NODE_SHORTCUTS_KEY } from "~/data/userSettings";
import type { CanvasNodeShortcuts } from "./utils/zodSchema";

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

  const persistValue = (value: string) => {
    setStoredValue(value);
    setPersonalSetting(valueKey, value);
    onValueChange(value);
  };

  const handleEnabledChange = (e: React.FormEvent<HTMLInputElement>) => {
    const checked = e.currentTarget.checked;
    setEnabled(checked);
    setPersonalSetting(enabledKey, checked);
    if (!checked) {
      persistValue("");
    }
    onEnabledChange(checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" || e.key === "Escape") return;
    e.preventDefault();
    if (e.key === "Backspace" || e.key === "Delete") {
      persistValue("");
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      persistValue(e.key);
    }
  };

  return (
    <>
      <Checkbox
        checked={enabled}
        onChange={handleEnabledChange}
        className="mb-0"
        labelElement={
          <>
            <span className="font-medium">{nodeText} node</span>{" "}
            <Description
              description={`Default: ${defaultShortcut || "none"}`}
            />
          </>
        }
      />
      <InputGroup
        value={enabled ? storedValue : ""}
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        disabled={!enabled}
        placeholder={defaultShortcut || "(no shortcut)"}
        className="w-20"
      />
    </>
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
    <Tabs renderActiveTabPanelOnly={true}>
      <Tab
        id="shortcuts"
        title="Shortcuts"
        panel={
          <div className="inline-grid grid-cols-[auto_5rem] items-center gap-x-4 gap-y-2 p-1">
            <div className="col-span-2 mb-2">
              <div className="text-base">
                Override the canvas keyboard shortcuts
              </div>
              <div className="text-sm italic text-gray-500">
                Changes take effect next time a canvas is opened
              </div>
            </div>
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
                  onValueChange={(value) =>
                    updateShortcut(node.type, { value })
                  }
                />
              );
            })}
          </div>
        }
      />
    </Tabs>
  );
};

export default CanvasShortcutSettings;
