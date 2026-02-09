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
import { GlobalFlagPanel } from "./components/BlockPropSettingPanels";

const SuggestiveModeSettings = () => {
  const settings = getFormattedConfigTree();

  const [suggestiveModeUid, setSuggestiveModeUid] = useState(
    settings.suggestiveMode.parentUid,
  );
  const pageGroupsUid = settings.suggestiveMode.pageGroups.uid;

  const [includePageRelations, setIncludePageRelations] = useState(
    settings.suggestiveMode.includePageRelations.value,
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
          title="Page groups"
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
          title="Sync config"
          panel={
            <div className="flex flex-col gap-4 p-1">
              <div className="sync-config-settings">
                <GlobalFlagPanel
                  title="Include current page relations"
                  description="Include relations from pages referenced on the current page"
                  settingKeys={[
                    "Suggestive mode",
                    "Include current page relations",
                  ]}
                  initialValue={
                    settings.suggestiveMode.includePageRelations.value
                  }
                  order={0}
                  uid={settings.suggestiveMode.includePageRelations.uid}
                  parentUid={effectiveSuggestiveModeUid}
                  onChange={setIncludePageRelations}
                />

                <GlobalFlagPanel
                  title="Include parent and child blocks"
                  description={
                    includePageRelations
                      ? "Include relations from parent and child blocks (automatically enabled when including page relations)"
                      : "Include relations from parent and child blocks"
                  }
                  settingKeys={[
                    "Suggestive mode",
                    "Include parent and child blocks",
                  ]}
                  initialValue={
                    settings.suggestiveMode.includeParentAndChildren.value
                  }
                  value={includePageRelations ? true : undefined}
                  order={1}
                  uid={settings.suggestiveMode.includeParentAndChildren.uid}
                  parentUid={effectiveSuggestiveModeUid}
                  disabled={includePageRelations}
                />
              </div>
              <div className="mt-4">
                <Button
                  icon="cloud-upload"
                  text={"Generate & upload all node embeddings"}
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
