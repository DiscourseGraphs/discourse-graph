import React, { useMemo, useState } from "react";
import { OnloadArgs } from "roamjs-components/types";
import { render as renderToast } from "roamjs-components/components/Toast";
import { Label, Dialog, Button, Intent } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import { addStyle } from "roamjs-components/dom";
import { NodeMenuTriggerComponent } from "~/components/DiscourseNodeMenu";
import {
  getOverlayHandler,
  getSuggestiveOverlayHandler,
  onPageRefObserverChange,
  previewPageRefHandler,
} from "~/utils/pageRefObserverHandlers";
import {
  showDiscourseFloatingMenu,
  hideDiscourseFloatingMenu,
} from "~/components/DiscourseFloatingMenu";
import { NodeSearchMenuTriggerSetting } from "../DiscourseNodeSearchMenu";
import {
  DISCOURSE_TOOL_SHORTCUT_KEY,
  AUTO_CANVAS_RELATIONS_KEY,
  DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY,
  STREAMLINE_STYLING_KEY,
  DISALLOW_DIAGNOSTICS,
  USE_REIFIED_RELATIONS,
} from "~/data/userSettings";
import { getSetting, setSetting } from "~/utils/extensionSettings";
import { enablePostHog, disablePostHog } from "~/utils/posthog";
import KeyboardShortcutInput from "./KeyboardShortcutInput";
import streamlineStyling from "~/styles/streamlineStyling";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import { PersonalFlagPanel } from "./components/BlockPropSettingPanels";
import migrateRelations from "~/utils/migrateRelations";
import { countReifiedRelations } from "~/utils/createReifiedBlock";
import posthog from "posthog-js";
import internalError from "~/utils/internalError";
import { setPersonalSetting } from "./utils/accessors";

const enum RelationMigrationDialog {
  "none",
  "activate",
  "deactivate",
  "reactivate",
}

const HomePersonalSettings = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const overlayHandler = getOverlayHandler(onloadArgs);
  const settings = useMemo(() => getFormattedConfigTree(), []);
  const [activeRelationMigration, setActiveRelationMigration] =
    useState<RelationMigrationDialog>(RelationMigrationDialog.none);
  const [numExistingRelations, setNumExistingRelations] = useState<number>(0);
  const [isOngoing, setOngoing] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let settingStoredMigrationValue = false;
  const setStoredRelations = (enabled: boolean) => {
    const panel = document.getElementById("stored-relation-flag");
    const checkboxList = panel?.getElementsByTagName("input");
    if (checkboxList && checkboxList.length > 0) {
      const checkbox = checkboxList.item(0)!;
      if (checkbox.checked !== enabled) {
        settingStoredMigrationValue = true;
        checkbox.click();
        settingStoredMigrationValue = false;
      }
    }
  };
  const startMigration = async (): Promise<void> => {
    const before = numExistingRelations;
    try {
      posthog.capture("Reified Relations: Migration Started");
      const numProcessed = await migrateRelations();
      if (numProcessed === false) {
        renderToast({
          content: "Reified Relations: Migration Failed",
          intent: Intent.DANGER,
          id: "migration-error",
        });
        setStoredRelations(false);
        return;
      }
      const after = await countReifiedRelations();
      setNumExistingRelations(after);
      if (before)
        renderToast({
          content: `${after - before} new relations created out of ${numProcessed} distinct relations processed`,
          intent: Intent.SUCCESS,
          id: "re-migration-success",
        });
      else
        renderToast({
          content: `${after} new relations created`,
          intent: Intent.SUCCESS,
          id: "migration-success",
        });
      posthog.capture("Reified Relations: Migration Completed", {
        processed: numProcessed,
        before,
        after,
        created: after - before,
      });
      setStoredRelations(true);
    } catch (error) {
      internalError({
        error,
        userMessage: "Reified Relations: Migration Failed",
      });
      setStoredRelations(false);
    } finally {
      setOngoing(false);
      setActiveRelationMigration(RelationMigrationDialog.none);
    }
  };
  return (
    <div className="flex flex-col gap-4 p-1">
      <Label>
        Personal node menu trigger
        <Description
          description={
            "Override the global trigger for the discourse node menu. Must refresh after editing."
          }
        />
        <NodeMenuTriggerComponent extensionAPI={extensionAPI} />
      </Label>
      <Label>
        Node search menu trigger
        <Description
          description={
            "Set the trigger character for the node search menu. Must refresh after editing."
          }
        />
        <NodeSearchMenuTriggerSetting onloadArgs={onloadArgs} />
      </Label>
      <KeyboardShortcutInput
        onloadArgs={onloadArgs}
        settingKey={DISCOURSE_TOOL_SHORTCUT_KEY}
        blockPropKey="Discourse tool shortcut"
        label="Discourse tool keyboard shortcut"
        description="Set a single key to activate the discourse tool in tldraw. Only single keys (no modifiers) are supported. Leave empty for no shortcut."
        placeholder="Click to set single key"
      />
      <PersonalFlagPanel
        title="Overlay"
        description="Whether or not to overlay discourse context information over discourse node references."
        settingKeys={["Discourse context overlay"]}
        initialValue={getSetting<boolean>("discourse-context-overlay", false)}
        onChange={(checked) => {
          void setSetting("discourse-context-overlay", checked);
          onPageRefObserverChange(overlayHandler)(checked);
          posthog.capture("Personal Settings: Overlay Toggled", {
            enabled: checked,
          });
        }}
      />
      {settings.suggestiveModeEnabled?.value && (
        <PersonalFlagPanel
          title="Suggestive mode overlay"
          description="Whether or not to overlay suggestive mode button over discourse node references."
          settingKeys={["Suggestive mode overlay"]}
          initialValue={getSetting<boolean>("suggestive-mode-overlay", false)}
          onChange={(checked) => {
            void setSetting("suggestive-mode-overlay", checked);
            onPageRefObserverChange(getSuggestiveOverlayHandler(onloadArgs))(
              checked,
            );
          }}
        />
      )}

      <div id="stored-relation-flag">
        <PersonalFlagPanel
          title="Enable stored relations"
          description="Transition to using stored relations instead of pattern-based relations"
          settingKeys={["Reified relation triples"]}
          initialValue={getSetting<boolean>(USE_REIFIED_RELATIONS, false)}
          onBeforeChange={async (checked) => {
            if (settingStoredMigrationValue) return true;
            if (checked) {
              countReifiedRelations()
                .then((num: number) => {
                  setNumExistingRelations(num);
                  setActiveRelationMigration(
                    num > 0
                      ? RelationMigrationDialog.reactivate
                      : RelationMigrationDialog.activate,
                  );
                })
                .catch((error) => {
                  internalError({ error });
                });
            } else {
              setActiveRelationMigration(RelationMigrationDialog.deactivate);
            }
            return false;
          }}
        />
      </div>

      <PersonalFlagPanel
        title="Text selection popup"
        description="Whether or not to show the discourse node menu when selecting text."
        settingKeys={["Text selection popup"]}
        initialValue={getSetting("text-selection-popup", true)}
        onChange={(checked) => {
          void setSetting("text-selection-popup", checked);
        }}
      />
      <PersonalFlagPanel
        title="Disable sidebar open"
        description="Disable opening new nodes in the sidebar when created"
        settingKeys={["Disable sidebar open"]}
        initialValue={getSetting<boolean>("disable-sidebar-open", false)}
        onChange={(checked) => {
          void setSetting("disable-sidebar-open", checked);
        }}
      />
      <PersonalFlagPanel
        title="Page preview"
        description="Whether or not to display page previews when hovering over page refs"
        settingKeys={["Page preview"]}
        initialValue={getSetting<boolean>("page-preview", false)}
        onChange={(checked) => {
          void setSetting("page-preview", checked);
          onPageRefObserverChange(previewPageRefHandler)(checked);
        }}
      />
      <PersonalFlagPanel
        title="Hide feedback button"
        description="Hide the 'Send feedback' button at the bottom right of the screen."
        settingKeys={["Hide feedback button"]}
        initialValue={getSetting<boolean>("hide-feedback-button", false)}
        onChange={(checked) => {
          void setSetting("hide-feedback-button", checked);
          if (checked) {
            hideDiscourseFloatingMenu();
          } else {
            showDiscourseFloatingMenu();
          }
        }}
      />
      <PersonalFlagPanel
        title="Auto canvas relations"
        description="Automatically add discourse relations to canvas when a node is added"
        settingKeys={["Auto canvas relations"]}
        initialValue={getSetting<boolean>(AUTO_CANVAS_RELATIONS_KEY, false)}
        onChange={(checked) => {
          void setSetting(AUTO_CANVAS_RELATIONS_KEY, checked);
        }}
      />

      <PersonalFlagPanel
        title="(BETA) Overlay in canvas"
        description="Whether or not to overlay discourse context information over canvas nodes."
        settingKeys={["Overlay in canvas"]}
        initialValue={getSetting<boolean>(
          DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY,
          false,
        )}
        onChange={(checked) => {
          void setSetting(DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY, checked);
        }}
      />
      <PersonalFlagPanel
        title="Streamline styling"
        description="Apply streamlined styling to your personal graph for a cleaner appearance."
        settingKeys={["Streamline styling"]}
        initialValue={getSetting<boolean>(STREAMLINE_STYLING_KEY, false)}
        onChange={(checked) => {
          void setSetting(STREAMLINE_STYLING_KEY, checked);
          const existingStyleElement =
            document.getElementById("streamline-styling");

          if (checked && !existingStyleElement) {
            const styleElement = addStyle(streamlineStyling);
            styleElement.id = "streamline-styling";
          } else if (!checked && existingStyleElement) {
            existingStyleElement.remove();
          }
        }}
      />
      <PersonalFlagPanel
        title="Disable product diagnostics"
        description="Disable sending usage signals and error reports that help us improve the product."
        settingKeys={["Disable product diagnostics"]}
        initialValue={getSetting<boolean>(DISALLOW_DIAGNOSTICS, false)}
        onChange={(checked) => {
          void setSetting(DISALLOW_DIAGNOSTICS, checked);
          if (checked) {
            disablePostHog();
          } else {
            enablePostHog();
          }
        }}
      />
      <Dialog
        isOpen={activeRelationMigration === RelationMigrationDialog.reactivate}
        onClose={() => {
          setActiveRelationMigration(RelationMigrationDialog.none);
        }}
      >
        <div className="p-4">
          {isOngoing ? (
            <p>Migrating relations, please wait</p>
          ) : (
            <div>
              <p>
                Activating the faster relations system will migrate all
                previously created relations and newly created relations will
                use the new system. You can deactivate this setting to revert to
                the old system, and your newly created relations will not be
                deleted; however, they will not be accessible until you
                reactivate the faster relation system.
              </p>
              <p>
                <Label>Relations</Label> {numExistingRelations}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  small
                  onClick={() => {
                    setActiveRelationMigration(RelationMigrationDialog.none);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  small
                  intent={Intent.PRIMARY}
                  onClick={() => {
                    setStoredRelations(true);
                    setActiveRelationMigration(RelationMigrationDialog.none);
                  }}
                >
                  Reactivate without Migration
                </Button>
                <Button
                  small
                  intent={Intent.PRIMARY}
                  onClick={() => {
                    setOngoing(true);
                    void startMigration();
                  }}
                >
                  Migrate again and Reactivate
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
      <Dialog
        isOpen={activeRelationMigration === RelationMigrationDialog.deactivate}
        onClose={() => {
          setActiveRelationMigration(RelationMigrationDialog.none);
        }}
      >
        <div className="p-4">
          <p>
            Deactivating the faster relations system will mean that any
            relations created using it will no longer be accessible. The
            discourse context overlay will still be usable with the previous
            relations system. Any relations created with the faster system will
            be accessible should you choose to reactivate.
          </p>
          <div className="flex items-center gap-2">
            <Button
              small
              onClick={() => {
                setActiveRelationMigration(RelationMigrationDialog.none);
              }}
            >
              Cancel
            </Button>
            <Button
              small
              intent={Intent.DANGER}
              onClick={() => {
                setStoredRelations(false);
                setActiveRelationMigration(RelationMigrationDialog.none);
              }}
            >
              Deactivate
            </Button>
          </div>
        </div>
      </Dialog>
      <Dialog
        isOpen={activeRelationMigration === RelationMigrationDialog.activate}
        onClose={() => {
          setActiveRelationMigration(RelationMigrationDialog.none);
        }}
      >
        <div className="p-4">
          {isOngoing ? (
            <p>Migrating relations, please wait</p>
          ) : (
            <div>
              <p>
                Activating the stored relations system will migrate all
                previously created relations and newly created relations will
                use the new system. You can deactivate this setting to revert to
                the old system, and your newly created relations will not be
                deleted; however, they will not be accessible until you
                reactivate the stored relation system.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  small
                  onClick={() => {
                    setActiveRelationMigration(RelationMigrationDialog.none);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  small
                  intent={Intent.PRIMARY}
                  onClick={() => {
                    setOngoing(true);
                    void startMigration();
                  }}
                >
                  Activate and Migrate
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default HomePersonalSettings;
