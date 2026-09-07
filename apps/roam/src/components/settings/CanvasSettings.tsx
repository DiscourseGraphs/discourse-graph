import React from "react";
import { OnloadArgs } from "roamjs-components/types";
import {
  DISCOURSE_TOOL_SHORTCUT_KEY,
  AUTO_CANVAS_RELATIONS_KEY,
} from "~/data/userSettings";
import { setSetting } from "~/utils/extensionSettings";
import KeyboardShortcutInput from "./KeyboardShortcutInput";
import CanvasShortcutSettings from "./CanvasShortcutSettings";
import {
  GlobalTextPanel,
  PersonalFlagPanel,
} from "./components/BlockPropSettingPanels";
import { GLOBAL_KEYS, PERSONAL_KEYS } from "./utils/settingKeys";
import { type SettingsSnapshot } from "./utils/accessors";
import { useLegacyConfigBlocks } from "./utils/useLegacyConfigBlocks";
import { SettingsSectionHeading } from "./components/SettingsHeadings";
import { ROAM_DOCS, withDocsLink } from "./utils/docs";

const CanvasSettings = ({
  onloadArgs,
  globalSettings,
  personalSettings,
}: {
  onloadArgs: OnloadArgs;
  globalSettings: SettingsSnapshot["globalSettings"];
  personalSettings: SettingsSnapshot["personalSettings"];
}) => {
  const legacyBlocks = useLegacyConfigBlocks();
  return (
    <div className="flex flex-col gap-4 p-1">
      <GlobalTextPanel
        title="Canvas Page Format"
        description="The page format for canvas pages"
        settingKeys={[GLOBAL_KEYS.canvasPageFormat]}
        initialValue={globalSettings[GLOBAL_KEYS.canvasPageFormat]}
        {...legacyBlocks.canvasPageFormat}
      />
      <KeyboardShortcutInput
        onloadArgs={onloadArgs}
        settingKey={DISCOURSE_TOOL_SHORTCUT_KEY}
        blockPropKey={PERSONAL_KEYS.discourseToolShortcut}
        label="Discourse tool keyboard shortcut"
        description={withDocsLink(
          "Set a single key to activate the discourse tool in tldraw. Only single keys (no modifiers) are supported. Leave empty for no shortcut.",
          ROAM_DOCS.creatingNodes,
        )}
        placeholder="Click to set single key"
        initialValue={personalSettings[PERSONAL_KEYS.discourseToolShortcut]}
      />
      <PersonalFlagPanel
        title="Auto canvas relations"
        description={withDocsLink(
          "Automatically add discourse relations to canvas when a node is added",
          ROAM_DOCS.storedRelations,
        )}
        settingKeys={[PERSONAL_KEYS.autoCanvasRelations]}
        initialValue={personalSettings[PERSONAL_KEYS.autoCanvasRelations]}
        onChange={(checked) => {
          void setSetting(AUTO_CANVAS_RELATIONS_KEY, checked);
        }}
      />
      <SettingsSectionHeading>Node on canvas</SettingsSectionHeading>
      <CanvasShortcutSettings personalSettings={personalSettings} />
    </div>
  );
};

export default CanvasSettings;
