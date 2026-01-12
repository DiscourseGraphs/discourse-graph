import React from "react";
import {
  GlobalFlagPanel,
  GlobalNumberPanel,
  GlobalSelectPanel,
  GlobalMultiTextPanel,
} from "./components/BlockPropSettingPanels";

const DiscourseGraphExport = () => {
  return (
    <div className="flex flex-col gap-4 p-1">
      <div>
        <GlobalFlagPanel
          title="remove special characters"
          description="Whether or not to remove the special characters in a file name"
          settingKeys={["Export", "Remove Special Characters"]}
          defaultValue={false}
        />

        <GlobalFlagPanel
          title="resolve block references"
          description="Replaces block references in the markdown content with the block's content"
          settingKeys={["Export", "Resolve Block References"]}
          defaultValue={false}
        />
        <GlobalFlagPanel
          title="resolve block embeds"
          description="Replaces block embeds in the markdown content with the block's content tree"
          settingKeys={["Export", "Resolve Block Embeds"]}
          defaultValue={false}
        />

        <GlobalFlagPanel
          title="append referenced node"
          description="If a referenced node is defined in a node's format, it will be appended to the discourse context"
          settingKeys={["Export", "Append Referenced Node"]}
          defaultValue={false}
        />
      </div>
      <div className="link-type-select-wrapper">
        <GlobalSelectPanel
          title="link type"
          description="How to format links that appear in your export."
          settingKeys={["Export", "Link Type"]}
          options={["alias", "wikilinks", "roam url"]}
          defaultValue="alias"
        />
      </div>
      <GlobalNumberPanel
        title="max filename length"
        description="Set the maximum name length for markdown file exports"
        settingKeys={["Export", "Max Filename Length"]}
        defaultValue={64}
        min={1}
      />
      <GlobalMultiTextPanel
        title="frontmatter"
        description="Specify all the lines that should go to the Frontmatter of the markdown file"
        settingKeys={["Export", "Frontmatter"]}
        defaultValue={[]}
      />
    </div>
  );
};

export default DiscourseGraphExport;
