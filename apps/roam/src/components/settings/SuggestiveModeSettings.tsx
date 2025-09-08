/* eslint-disable @typescript-eslint/naming-convention */
import React, { useEffect, useState } from "react";
import { Button, Intent } from "@blueprintjs/core";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import PageGroupsPanel from "./PageGroupPanel";
import createBlock from "roamjs-components/writes/createBlock";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import { createOrUpdateDiscourseEmbedding } from "~/utils/syncDgNodesToSupabase";
import { render as renderToast } from "roamjs-components/components/Toast";

const SuggestiveModeSettings = () => {
  const settings = getFormattedConfigTree();

  const [suggestiveModeUid, setSuggestiveModeUid] = useState(
    settings.suggestiveMode.parentUid,
  );
  useEffect(() => {
    if (suggestiveModeUid) return;
    void (async () => {
      const smUid = await createBlock({
        parentUid: getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
        node: { text: "Suggestive Mode" },
      });
      setSuggestiveModeUid(smUid);
    })();
  }, [suggestiveModeUid]);

  const effectiveSuggestiveModeUid =
    suggestiveModeUid || settings.suggestiveMode.parentUid;

  return (
    <div className="relative flex flex-col gap-4 p-1">
      <div className="mt-4">
        <Button
          icon="cloud-upload"
          text={"Generate & Upload All Node Embeddings"}
          onClick={() =>
            void (async () => {
              renderToast({
                id: "discourse-embedding-start",
                content:
                  "Creating and uploading your discourse node's embeddings to supabase",
                intent: "primary",
                timeout: 3000,
              });
              await createOrUpdateDiscourseEmbedding();
            })()
          }
          intent={Intent.PRIMARY}
          className={"mt-2"}
        />
      </div>
      <div className="context-settings">
        <FlagPanel
          title="Include Current Page Relations"
          description="Include relations from pages referenced on the current page"
          order={0}
          uid={settings.suggestiveMode.includePageRelations.uid}
          parentUid={effectiveSuggestiveModeUid}
          value={settings.suggestiveMode.includePageRelations.value}
        />

        {/* TODO: if "Include Current Page Relations" is checked "Include Parent and Child Blocks"
         should be checked and disabled, use `selection` instead */}
        <FlagPanel
          title="Include Parent And Child Blocks"
          description="Include relations from parent and child blocks"
          order={1}
          uid={settings.suggestiveMode.includeParentAndChildren.uid}
          parentUid={effectiveSuggestiveModeUid}
          value={settings.suggestiveMode.includeParentAndChildren.value}
        />
      </div>
      <div className="page-groups-settings">
        <PageGroupsPanel
          uid={settings.suggestiveMode.pageGroups.uid}
          initialGroups={settings.suggestiveMode.pageGroups.groups}
        />
      </div>
    </div>
  );
};

export default SuggestiveModeSettings;
