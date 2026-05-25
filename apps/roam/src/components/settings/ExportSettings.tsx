import React from "react";
import { getExportSettingsAndUids } from "~/utils/getExportSettings";
import {
  GlobalFlagPanel,
  GlobalNumberPanel,
  GlobalMultiTextPanel,
  GlobalSelectPanel,
} from "./components/BlockPropSettingPanels";
import {
  GLOBAL_KEYS,
  EXPORT_KEYS,
} from "~/components/settings/utils/settingKeys";
import { type SettingsSnapshot } from "./utils/accessors";
import { ROAM_DOCS, withDocsLink } from "./utils/docs";

const DiscourseGraphExport = ({
  globalSettings,
}: {
  globalSettings: SettingsSnapshot["globalSettings"];
}) => {
  const exportBlockProps = globalSettings.Export;
  const exportSettings = getExportSettingsAndUids();
  const parentUid = exportSettings.exportUid;
  return (
    <div className="flex flex-col gap-4 p-1">
      {/* TODO: Titles kept as lowercase to match legacy readers in getExportSettings.ts.
          Update titles to Sentence case once read side is migrated to block props. */}
      <div>
        <GlobalFlagPanel
          title="remove special characters"
          description={withDocsLink(
            "Whether or not to remove the special characters in a file name.",
            ROAM_DOCS.sharing,
          )}
          settingKeys={[
            GLOBAL_KEYS.export,
            EXPORT_KEYS.removeSpecialCharacters,
          ]}
          initialValue={exportBlockProps[EXPORT_KEYS.removeSpecialCharacters]}
          order={1}
          uid={exportSettings.removeSpecialCharacters.uid}
          parentUid={parentUid}
        />

        <GlobalFlagPanel
          title="resolve block references"
          description={withDocsLink(
            "Replaces block references in the markdown content with the block's content.",
            ROAM_DOCS.sharing,
          )}
          settingKeys={[GLOBAL_KEYS.export, EXPORT_KEYS.resolveBlockReferences]}
          initialValue={exportBlockProps[EXPORT_KEYS.resolveBlockReferences]}
          order={3}
          uid={exportSettings.optsRefs.uid}
          parentUid={parentUid}
        />
        <GlobalFlagPanel
          title="resolve block embeds"
          description={withDocsLink(
            "Replaces block embeds in the markdown content with the block's content tree.",
            ROAM_DOCS.sharing,
          )}
          settingKeys={[GLOBAL_KEYS.export, EXPORT_KEYS.resolveBlockEmbeds]}
          initialValue={exportBlockProps[EXPORT_KEYS.resolveBlockEmbeds]}
          order={4}
          uid={exportSettings.optsEmbeds.uid}
          parentUid={parentUid}
        />

        <GlobalFlagPanel
          title="append referenced node"
          description={withDocsLink(
            "If a referenced node is defined in a node's format, it will be appended to the discourse context.",
            ROAM_DOCS.sharing,
          )}
          settingKeys={[GLOBAL_KEYS.export, EXPORT_KEYS.appendReferencedNode]}
          initialValue={exportBlockProps[EXPORT_KEYS.appendReferencedNode]}
          order={6}
          uid={exportSettings.appendRefNodeContext.uid}
          parentUid={parentUid}
        />
      </div>
      <div className="link-type-select-wrapper">
        <GlobalSelectPanel
          title="link type"
          description={withDocsLink(
            "How to format links that appear in your export.",
            ROAM_DOCS.sharing,
          )}
          settingKeys={[GLOBAL_KEYS.export, EXPORT_KEYS.linkType]}
          initialValue={exportBlockProps[EXPORT_KEYS.linkType]}
          order={5}
          options={["alias", "wikilinks", "roam url"]}
          uid={exportSettings.linkType.uid}
          parentUid={parentUid}
        />
      </div>
      <GlobalNumberPanel
        title="max filename length"
        description={withDocsLink(
          "Set the maximum name length for markdown file exports.",
          ROAM_DOCS.sharing,
        )}
        settingKeys={[GLOBAL_KEYS.export, EXPORT_KEYS.maxFilenameLength]}
        initialValue={exportBlockProps[EXPORT_KEYS.maxFilenameLength]}
        order={0}
        uid={exportSettings.maxFilenameLength.uid}
        parentUid={parentUid}
      />
      <GlobalMultiTextPanel
        title="frontmatter"
        description={withDocsLink(
          "Specify all the lines that should go to the Frontmatter of the markdown file.",
          ROAM_DOCS.sharing,
        )}
        settingKeys={[GLOBAL_KEYS.export, EXPORT_KEYS.frontmatter]}
        initialValue={exportBlockProps[EXPORT_KEYS.frontmatter]}
        order={2}
        uid={exportSettings.frontmatter.uid}
        parentUid={parentUid}
      />
    </div>
  );
};

export default DiscourseGraphExport;
