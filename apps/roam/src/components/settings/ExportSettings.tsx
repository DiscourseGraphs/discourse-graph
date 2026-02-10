import React from "react";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import {
  GlobalFlagPanel,
  GlobalNumberPanel,
  GlobalMultiTextPanel,
  GlobalSelectPanel,
} from "./components/BlockPropSettingPanels";

const DiscourseGraphExport = () => {
  const settings = getFormattedConfigTree();
  const exportSettings = settings.export;
  const parentUid = settings.export.exportUid;
  return (
    <div className="flex flex-col gap-4 p-1">
      {/* TODO: Titles kept as lowercase to match legacy readers in getExportSettings.ts.
          Update titles to Sentence case once read side is migrated to block props. */}
      <div>
        <GlobalFlagPanel
          title="remove special characters"
          description="Whether or not to remove the special characters in a file name"
          settingKeys={["Export", "Remove special characters"]}
          initialValue={exportSettings.removeSpecialCharacters.value}
          order={1}
          uid={exportSettings.removeSpecialCharacters.uid}
          parentUid={parentUid}
        />

        <GlobalFlagPanel
          title="resolve block references"
          description="Replaces block references in the markdown content with the block's content"
          settingKeys={["Export", "Resolve block references"]}
          initialValue={exportSettings.optsRefs.value}
          order={3}
          uid={exportSettings.optsRefs.uid}
          parentUid={parentUid}
        />
        <GlobalFlagPanel
          title="resolve block embeds"
          description="Replaces block embeds in the markdown content with the block's content tree"
          settingKeys={["Export", "Resolve block embeds"]}
          initialValue={exportSettings.optsEmbeds.value}
          order={4}
          uid={exportSettings.optsEmbeds.uid}
          parentUid={parentUid}
        />

        <GlobalFlagPanel
          title="append referenced node"
          description="If a referenced node is defined in a node's format, it will be appended to the discourse context"
          settingKeys={["Export", "Append referenced node"]}
          initialValue={exportSettings.appendRefNodeContext.value}
          order={6}
          uid={exportSettings.appendRefNodeContext.uid}
          parentUid={parentUid}
        />
      </div>
      <div className="link-type-select-wrapper">
        <GlobalSelectPanel
          title="link type"
          description="How to format links that appear in your export."
          settingKeys={["Export", "Link type"]}
          initialValue={exportSettings.linkType.value || "alias"}
          order={5}
          options={["alias", "wikilinks", "roam url"]}
          uid={exportSettings.linkType.uid}
          parentUid={parentUid}
        />
      </div>
      <GlobalNumberPanel
        title="max filename length"
        description="Set the maximum name length for markdown file exports"
        settingKeys={["Export", "Max filename length"]}
        initialValue={exportSettings.maxFilenameLength.value || 64}
        order={0}
        uid={exportSettings.maxFilenameLength.uid}
        parentUid={parentUid}
      />
      <GlobalMultiTextPanel
        title="frontmatter"
        description="Specify all the lines that should go to the Frontmatter of the markdown file"
        settingKeys={["Export", "Frontmatter"]}
        initialValue={exportSettings.frontmatter.values}
        order={2}
        uid={exportSettings.frontmatter.uid}
        parentUid={parentUid}
      />
    </div>
  );
};

export default DiscourseGraphExport;
