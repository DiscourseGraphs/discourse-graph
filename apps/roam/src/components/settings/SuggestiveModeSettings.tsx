import React, { useEffect, useState } from "react";
import { Button, Intent } from "@blueprintjs/core";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import PageGroupsPanel from "./PageGroupPanel";
import createBlock from "roamjs-components/writes/createBlock";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";

const SuggestiveModeSettings = () => {
  const [settings, setSettings] = useState(() => {
    refreshConfigTree();
    return getFormattedConfigTree();
  });

  useEffect(() => {
    const ensureSettings = async () => {
      if (!settings.suggestiveMode.parentUid) {
        await createBlock({
          parentUid: getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
          node: { text: "Suggestive mode" },
        });
        refreshConfigTree();
        setSettings(getFormattedConfigTree());
      }
    };
    ensureSettings();
  }, [settings.suggestiveMode.parentUid]);

  return (
    <div className="relative flex flex-col gap-4 p-1">
      <div className="mb-2 text-lg font-semibold text-neutral-dark">
        Discourse Suggestions
      </div>
      <div className="mt-4">
        <Button
          icon="cloud-upload"
          text={"Generate & Upload All Node Embeddings"}
          onClick={() => console.log("Not implemented")}
          intent={Intent.PRIMARY}
          style={{ marginTop: "8px" }}
        />
      </div>
      <div className="context-settings">
        <FlagPanel
          title="Include Current Page Relations"
          description="Include relations from pages referenced on the current page"
          order={0}
          uid={settings.suggestiveMode.grabFromReferencedPages.uid}
          parentUid={settings.suggestiveMode.parentUid}
          value={settings.suggestiveMode.grabFromReferencedPages.value}
        />
        <FlagPanel
          title="Include Parent And Child Blocks"
          description="Include relations from parent and child blocks"
          order={1}
          uid={settings.suggestiveMode.grabParentAndChildren.uid}
          parentUid={settings.suggestiveMode.parentUid}
          value={settings.suggestiveMode.grabParentAndChildren.value}
        />
      </div>
      <div className="page-groups-settings">
        <PageGroupsPanel uid={settings.suggestiveMode.pageGroups.uid} />
      </div>
    </div>
  );
};

export default SuggestiveModeSettings;
