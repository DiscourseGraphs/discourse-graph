import React, { useMemo, useState } from "react";
import { OnloadArgs } from "roamjs-components/types";
import { render as renderToast } from "roamjs-components/components/Toast";
import { Label, Dialog, Button, Intent, Classes } from "@blueprintjs/core";
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
  USE_STORED_RELATIONS,
} from "~/data/userSettings";
import { setSetting } from "~/utils/extensionSettings";
import { enablePostHog, disablePostHog } from "~/utils/posthog";
import KeyboardShortcutInput from "./KeyboardShortcutInput";
import streamlineStyling from "~/styles/streamlineStyling";
import { PersonalFlagPanel } from "./components/BlockPropSettingPanels";
import { PERSONAL_KEYS } from "./utils/settingKeys";
import migrateRelations from "~/utils/migrateRelations";
import { countReifiedRelations } from "~/utils/createReifiedBlock";
import posthog from "posthog-js";
import internalError from "~/utils/internalError";
import { bulkReadSettings, setPersonalSetting } from "./utils/accessors";
import { getStoredRelationsEnabled } from "~/utils/storedRelations";

const enum RelationMigrationDialog {
  "none",
  "activate",
  "deactivate",
  "reactivate",
}

const HomePersonalSettings = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const [snapshot] = useState(() => bulkReadSettings());
  const personalSettings = snapshot.personalSettings;
  const featureFlags = snapshot.featureFlags;
  const extensionAPI = onloadArgs.extensionAPI;
  const overlayHandler = getOverlayHandler(onloadArgs);
  const [activeRelationMigration, setActiveRelationMigration] =
    useState<RelationMigrationDialog>(RelationMigrationDialog.none);
  const [numExistingRelations, setNumExistingRelations] = useState<number>(0);
  const [isOngoing, setIsOngoing] = useState<boolean>(false);
  const [storedRelations, setStoredRelationsState] = useState<boolean>(
    getStoredRelationsEnabled(),
  );
  const setStoredRelations = (value: boolean) => {
    setSetting<boolean>(USE_STORED_RELATIONS, value)
      .then(() => {
        setStoredRelationsState(value);
        setPersonalSetting(["Reified relation triples"], value);
      })
      .catch((error) => {
        internalError({ error });
      });
  };
  const startMigration = async (): Promise<void> => {
    const before = numExistingRelations;
    try {
      posthog.capture("Stored Relations: Migration Started");
      const numProcessed = await migrateRelations();
      if (numProcessed === false) {
        renderToast({
          content: "Stored Relations: Migration Failed",
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
      posthog.capture("Stored Relations: Migration Completed", {
        processed: numProcessed,
        before,
        after,
        created: after - before,
      });
      setStoredRelations(true);
    } catch (error) {
      internalError({
        error,
        userMessage: "Stored Relations: Migration Failed",
      });
      setStoredRelations(false);
    } finally {
      setIsOngoing(false);
      setActiveRelationMigration(RelationMigrationDialog.none);
    }
  };
  return (
    <div className="flex flex-col gap-4 p-1">
      <Label>
        Personal node menu trigger
        <Description description="Override the global trigger for the discourse node menu." />
        <NodeMenuTriggerComponent
          extensionAPI={extensionAPI}
          initialValue={personalSettings[PERSONAL_KEYS.personalNodeMenuTrigger]}
        />
      </Label>
      <Label>
        Node search menu trigger
        <Description description="Set the trigger character for the node search menu." />
        <NodeSearchMenuTriggerSetting
          onloadArgs={onloadArgs}
          initialValue={personalSettings[PERSONAL_KEYS.nodeSearchMenuTrigger]}
        />
      </Label>
      <KeyboardShortcutInput
        onloadArgs={onloadArgs}
        settingKey={DISCOURSE_TOOL_SHORTCUT_KEY}
        blockPropKey={PERSONAL_KEYS.discourseToolShortcut}
        label="Discourse tool keyboard shortcut"
        description="Set a single key to activate the discourse tool in tldraw. Only single keys (no modifiers) are supported. Leave empty for no shortcut."
        placeholder="Click to set single key"
        initialValue={personalSettings[PERSONAL_KEYS.discourseToolShortcut]}
      />
      <PersonalFlagPanel
        title="Overlay"
        description="Whether or not to overlay discourse context information over discourse node references."
        settingKeys={[PERSONAL_KEYS.discourseContextOverlay]}
        initialValue={personalSettings[PERSONAL_KEYS.discourseContextOverlay]}
        onChange={(checked) => {
          void setSetting("discourse-context-overlay", checked);
          onPageRefObserverChange(overlayHandler)(checked);
          posthog.capture("Personal Settings: Overlay Toggled", {
            enabled: checked,
          });
        }}
      />
      {featureFlags["Suggestive mode enabled"] && (
        <PersonalFlagPanel
          title="Suggestive mode overlay"
          description="Whether or not to overlay suggestive mode button over discourse node references."
          settingKeys={[PERSONAL_KEYS.suggestiveModeOverlay]}
          initialValue={personalSettings[PERSONAL_KEYS.suggestiveModeOverlay]}
          onChange={(checked) => {
            void setSetting("suggestive-mode-overlay", checked);
            onPageRefObserverChange(getSuggestiveOverlayHandler(onloadArgs))(
              checked,
            );
          }}
        />
      )}

      <PersonalFlagPanel
        title="Enable stored relations"
        description="Use stored relations instead of legacy pattern-based relations"
        settingKeys={["Reified relation triples"]}
        initialValue={personalSettings["Reified relation triples"]}
        value={storedRelations}
        onBeforeChange={async (checked) => {
          if (checked) {
            const num = await countReifiedRelations();
            setNumExistingRelations(num);
            setActiveRelationMigration(
              num > 0
                ? RelationMigrationDialog.reactivate
                : RelationMigrationDialog.activate,
            );
          } else {
            setActiveRelationMigration(RelationMigrationDialog.deactivate);
          }
          return false;
        }}
      />

      <PersonalFlagPanel
        title="Text selection popup"
        description="Whether or not to show the discourse node menu when selecting text."
        settingKeys={[PERSONAL_KEYS.textSelectionPopup]}
        initialValue={personalSettings[PERSONAL_KEYS.textSelectionPopup]}
        onChange={(checked) => {
          void setSetting("text-selection-popup", checked);
        }}
      />
      <PersonalFlagPanel
        title="Disable sidebar open"
        description="Disable opening new nodes in the sidebar when created"
        settingKeys={[PERSONAL_KEYS.disableSidebarOpen]}
        initialValue={personalSettings[PERSONAL_KEYS.disableSidebarOpen]}
        onChange={(checked) => {
          void setSetting("disable-sidebar-open", checked);
        }}
      />
      <PersonalFlagPanel
        title="Page preview"
        description="Whether or not to display page previews when hovering over page refs"
        settingKeys={[PERSONAL_KEYS.pagePreview]}
        initialValue={personalSettings[PERSONAL_KEYS.pagePreview]}
        onChange={(checked) => {
          void setSetting("page-preview", checked);
          onPageRefObserverChange(previewPageRefHandler)(checked);
        }}
      />
      <PersonalFlagPanel
        title="Hide feedback button"
        description="Hide the 'Send feedback' button at the bottom right of the screen."
        settingKeys={[PERSONAL_KEYS.hideFeedbackButton]}
        initialValue={personalSettings[PERSONAL_KEYS.hideFeedbackButton]}
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
        settingKeys={[PERSONAL_KEYS.autoCanvasRelations]}
        initialValue={personalSettings[PERSONAL_KEYS.autoCanvasRelations]}
        onChange={(checked) => {
          void setSetting(AUTO_CANVAS_RELATIONS_KEY, checked);
        }}
      />

      <PersonalFlagPanel
        title="(BETA) Overlay in canvas"
        description="Whether or not to overlay discourse context information over canvas nodes."
        settingKeys={[PERSONAL_KEYS.overlayInCanvas]}
        initialValue={personalSettings[PERSONAL_KEYS.overlayInCanvas]}
        onChange={(checked) => {
          void setSetting(DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY, checked);
        }}
      />
      <PersonalFlagPanel
        title="Streamline styling"
        description="Apply streamlined styling to your personal graph for a cleaner appearance."
        settingKeys={[PERSONAL_KEYS.streamlineStyling]}
        initialValue={personalSettings[PERSONAL_KEYS.streamlineStyling]}
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
        settingKeys={[PERSONAL_KEYS.disableProductDiagnostics]}
        initialValue={personalSettings[PERSONAL_KEYS.disableProductDiagnostics]}
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
        isOpen={
          activeRelationMigration === RelationMigrationDialog.reactivate ||
          activeRelationMigration === RelationMigrationDialog.activate
        }
        onClose={() => {
          setActiveRelationMigration(RelationMigrationDialog.none);
        }}
        style={{ width: "600px" }}
      >
        <div className={Classes.DIALOG_BODY}>
          {isOngoing ? (
            <p>Migrating relations, please wait</p>
          ) : (
            <>
              <p>
                Activating stored relations will migrate all previously created
                legacy pattern relations, and newly created relations will use
                stored relations. You can deactivate this setting to revert to
                the legacy system, and your newly created relations will not be
                deleted; however, they will not be accessible until you
                reactivate stored relations.
              </p>
              {activeRelationMigration ===
              RelationMigrationDialog.reactivate ? (
                <div className="flex flex-col items-center">
                  <Label className="font-semibold">Relations</Label>
                  <pre className="m-0 rounded border border-gray-300 bg-gray-50 p-2 text-center">
                    {numExistingRelations}
                  </pre>
                </div>
              ) : null}
            </>
          )}
        </div>
        {!isOngoing && (
          <div className={Classes.DIALOG_FOOTER}>
            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
              <Button
                small
                onClick={() => {
                  setActiveRelationMigration(RelationMigrationDialog.none);
                }}
              >
                Cancel
              </Button>
              {activeRelationMigration ===
              RelationMigrationDialog.reactivate ? (
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
              ) : null}
              <Button
                small
                intent={Intent.PRIMARY}
                onClick={() => {
                  setIsOngoing(true);
                  void startMigration();
                }}
              >
                {activeRelationMigration === RelationMigrationDialog.reactivate
                  ? "Migrate again and Reactivate"
                  : "Activate and Migrate"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog
        isOpen={activeRelationMigration === RelationMigrationDialog.deactivate}
        onClose={() => {
          setActiveRelationMigration(RelationMigrationDialog.none);
        }}
      >
        <div className={Classes.DIALOG_BODY}>
          <p>
            Deactivating stored relations means any relations created using them
            will no longer be accessible. The discourse context overlay will
            still be usable with the legacy pattern-based system. Any relations
            created with stored relations will be accessible should you choose
            to reactivate.
          </p>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
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
    </div>
  );
};

export default HomePersonalSettings;
