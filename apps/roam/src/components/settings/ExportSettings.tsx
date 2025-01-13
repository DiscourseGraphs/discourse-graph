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
          order={1}
          uid={exportSettings.removeSpecialCharacters.uid}
          parentUid={parentUid}
          value={exportSettings.removeSpecialCharacters.value || false}
        />

        <FlagPanel
          title="resolve block references"
          description="Replaces block references in the markdown content with the block's content"
          order={3}
          uid={exportSettings.optsRefs.uid}
          parentUid={parentUid}
          value={exportSettings.optsRefs.value || false}
        />
        <FlagPanel
          title="resolve block embeds"
          description="Replaces block embeds in the markdown content with the block's content tree"
          order={4}
          uid={exportSettings.optsEmbeds.uid}
          parentUid={parentUid}
          value={exportSettings.optsEmbeds.value || false}
        />

        <FlagPanel
          title="append referenced node"
          description="If a referenced node is defined in a node's format, it will be appended to the discourse context"
          order={6}
          uid={exportSettings.appendRefNodeContext.uid}
          parentUid={parentUid}
          value={exportSettings.appendRefNodeContext.value || false}
        />
      </div>
      <SelectPanel
        title="link type"
        description="How to format links that appear in your export."
        order={5}
        options={{
          items: ["alias", "wikilinks", "roam url"],
        }}
        uid={exportSettings.linkType.uid}
        parentUid={parentUid}
        value={exportSettings.linkType.value || "alias"}
      />
      <NumberPanel
        title="max filename length"
        description="Set the maximum name length for markdown file exports"
        order={0}
        uid={exportSettings.maxFilenameLength.uid}
        parentUid={parentUid}
        value={exportSettings.maxFilenameLength.value || 64}
      />
      <MultiTextPanel
        title="frontmatter"
        description="Specify all the lines that should go to the Frontmatter of the markdown file"
        order={2}
        uid={exportSettings.frontmatter.uid}
        parentUid={parentUid}
        value={exportSettings.frontmatter.values || []}
      />
    </div>
  );
};

export default DiscourseGraphExport;
