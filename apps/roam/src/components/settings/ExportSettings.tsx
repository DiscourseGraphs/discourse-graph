import React from "react";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import MultiTextPanel from "roamjs-components/components/ConfigPanels/MultiTextPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";

const DiscourseGraphExport = ({}: {}) => {
  const settings = getFormattedConfigTree();
  const exportSettings = settings.export;
  const parentUid = settings.export.exportUid;
  return (
    <div className="flex flex-col gap-4 p-1">
      <div>
        <FlagPanel
          title="remove special characters"
          description="Whether or not to remove the special characters in a file name"
<<<<<<< HEAD
=======
          settingKeys={["Export", "Remove Special Characters"]}
          defaultValue={exportSettings.removeSpecialCharacters.value || false}
>>>>>>> 84aa5ac2 (restack and fix unnecessary changes)
          order={1}
          uid={exportSettings.removeSpecialCharacters.uid}
          parentUid={parentUid}
          value={exportSettings.removeSpecialCharacters.value || false}
        />

        <FlagPanel
          title="resolve block references"
          description="Replaces block references in the markdown content with the block's content"
<<<<<<< HEAD
=======
          settingKeys={["Export", "Resolve Block References"]}
          defaultValue={exportSettings.optsRefs.value || false}
>>>>>>> 84aa5ac2 (restack and fix unnecessary changes)
          order={3}
          uid={exportSettings.optsRefs.uid}
          parentUid={parentUid}
          value={exportSettings.optsRefs.value || false}
        />
        <FlagPanel
          title="resolve block embeds"
          description="Replaces block embeds in the markdown content with the block's content tree"
<<<<<<< HEAD
=======
          settingKeys={["Export", "Resolve Block Embeds"]}
          defaultValue={exportSettings.optsEmbeds.value || false}
>>>>>>> 84aa5ac2 (restack and fix unnecessary changes)
          order={4}
          uid={exportSettings.optsEmbeds.uid}
          parentUid={parentUid}
          value={exportSettings.optsEmbeds.value || false}
        />

        <FlagPanel
          title="append referenced node"
          description="If a referenced node is defined in a node's format, it will be appended to the discourse context"
<<<<<<< HEAD
=======
          settingKeys={["Export", "Append Referenced Node"]}
          defaultValue={exportSettings.appendRefNodeContext.value || false}
>>>>>>> 84aa5ac2 (restack and fix unnecessary changes)
          order={6}
          uid={exportSettings.appendRefNodeContext.uid}
          parentUid={parentUid}
          value={exportSettings.appendRefNodeContext.value || false}
        />
      </div>
      <div className="link-type-select-wrapper">
        <SelectPanel
          title="link type"
          description="How to format links that appear in your export."
<<<<<<< HEAD
=======
          settingKeys={["Export", "Link Type"]}
          options={["alias", "wikilinks", "roam url"]}
          defaultValue={exportSettings.linkType.value || "alias"}
>>>>>>> 84aa5ac2 (restack and fix unnecessary changes)
          order={5}
          options={{
            items: ["alias", "wikilinks", "roam url"],
          }}
          uid={exportSettings.linkType.uid}
          parentUid={parentUid}
          value={exportSettings.linkType.value || "alias"}
        />
      </div>
      <NumberPanel
        title="max filename length"
        description="Set the maximum name length for markdown file exports"
<<<<<<< HEAD
=======
        settingKeys={["Export", "Max Filename Length"]}
        defaultValue={exportSettings.maxFilenameLength.value || 64}
>>>>>>> 84aa5ac2 (restack and fix unnecessary changes)
        order={0}
        uid={exportSettings.maxFilenameLength.uid}
        parentUid={parentUid}
        value={exportSettings.maxFilenameLength.value || 64}
      />
      <MultiTextPanel
        title="frontmatter"
        description="Specify all the lines that should go to the Frontmatter of the markdown file"
<<<<<<< HEAD
=======
        settingKeys={["Export", "Frontmatter"]}
        defaultValue={exportSettings.frontmatter.values || []}
>>>>>>> 84aa5ac2 (restack and fix unnecessary changes)
        order={2}
        uid={exportSettings.frontmatter.uid}
        parentUid={parentUid}
        value={exportSettings.frontmatter.values || []}
      />
    </div>
  );
};

export default DiscourseGraphExport;
