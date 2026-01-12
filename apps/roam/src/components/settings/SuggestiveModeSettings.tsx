/* eslint-disable @typescript-eslint/naming-convention */
import React, { useEffect, useState } from "react";
import { Button, Intent, Tabs, Tab, TabId } from "@blueprintjs/core";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import PageGroupsPanel from "./PageGroupPanel";
import createBlock from "roamjs-components/writes/createBlock";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import { createOrUpdateDiscourseEmbedding } from "~/utils/syncDgNodesToSupabase";
import { render as renderToast } from "roamjs-components/components/Toast";
import { BlockPropFlagPanel } from "./components/BlockPropGlobalSettingPanels";
import { getGlobalSetting } from "./utils/accessors";

const SuggestiveModeSettings = () => {
  // Keep old config tree for PageGroups (not yet migrated)
  const settings = getFormattedConfigTree();
  const pageGroupsUid = settings.suggestiveMode.pageGroups.uid;

  const [suggestiveModeUid, setSuggestiveModeUid] = useState(
    settings.suggestiveMode.parentUid,
  );

  // Track includePageRelations to control the disabled state of includeParentAndChildren
  const [includePageRelations, setIncludePageRelations] = useState(() =>
    getGlobalSetting<boolean>([
      "Suggestive Mode",
      "Include Current Page Relations",
    ]),
  );

  // Keep this useEffect for PageGroups compatibility (old system)
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

  const [selectedTabId, setSelectedTabId] = useState<TabId>("page-groups");

  return (
    <>
      <Tabs
        onChange={(id) => setSelectedTabId(id)}
        selectedTabId={selectedTabId}
        renderActiveTabPanelOnly={true}
      >
        <Tab
          id="page-groups"
          title="Page Groups"
          panel={
            <div className="flex flex-col gap-4 p-1">
              <PageGroupsPanel
                key={pageGroupsUid}
                uid={pageGroupsUid}
                initialGroups={settings.suggestiveMode.pageGroups.groups}
              />
            </div>
          }
        />
        <Tab
          id="sync-config"
          title="Sync Config"
          panel={
            <div className="flex flex-col gap-4 p-1">
              <div className="sync-config-settings">
                <BlockPropFlagPanel
                  title="Include Current Page Relations"
                  description="Include relations from pages referenced on the current page"
                  settingKeys={["Suggestive Mode", "Include Current Page Relations"]}
                  onChange={setIncludePageRelations}
                />

                <BlockPropFlagPanel
                  title="Include Parent And Child Blocks"
                  description={
                    includePageRelations
                      ? "Include relations from parent and child blocks (automatically enabled when including page relations)"
                      : "Include relations from parent and child blocks"
                  }
                  settingKeys={["Suggestive Mode", "Include Parent And Child Blocks"]}
                  disabled={includePageRelations}
                />
              </div>
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
                      try {
                        await createOrUpdateDiscourseEmbedding();
                      } catch (e) {
                        console.error("Failed to generate embeddings", e);
                        renderToast({
                          id: "discourse-embedding-error",
                          content:
                            "Embedding generation failed. Check the console.",
                          intent: "danger",
                          timeout: 5000,
                        });
                      }
                    })()
                  }
                  intent={Intent.PRIMARY}
                  className={"mt-2"}
                />
              </div>
            </div>
          }
        />
      </Tabs>
    </>
  );
};

export default SuggestiveModeSettings;
