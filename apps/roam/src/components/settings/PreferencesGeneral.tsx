import React, { useState } from "react";
import { OnloadArgs } from "roamjs-components/types";
import { render as renderToast } from "roamjs-components/components/Toast";
import { Label, Dialog, Button, Intent, Classes } from "@blueprintjs/core";
import posthog from "posthog-js";
import Description from "~/components/settings/SettingsDescription";
import { NodeMenuTriggerComponent } from "~/components/DiscourseNodeMenu";
import { NodeSearchMenuTriggerSetting } from "../DiscourseNodeSearchMenu";
import {
  DISALLOW_DIAGNOSTICS,
  USE_STORED_RELATIONS,
} from "~/data/userSettings";
import { setSetting } from "~/utils/extensionSettings";
import { enablePostHog, disablePostHog } from "~/utils/posthog";
import migrateRelations from "~/utils/migrateRelations";
import { countReifiedRelations } from "~/utils/createReifiedBlock";
import internalError from "~/utils/internalError";
import { getStoredRelationsEnabled } from "~/utils/storedRelations";
import {
  GlobalTextPanel,
  PersonalFlagPanel,
} from "./components/BlockPropSettingPanels";
import { GLOBAL_KEYS, PERSONAL_KEYS } from "./utils/settingKeys";
import { setPersonalSetting, type SettingsSnapshot } from "./utils/accessors";
import { useLegacyConfigBlocks } from "./utils/useLegacyConfigBlocks";
import { SettingsGroup } from "./components/SettingsHeadings";
import { settingAnchor } from "./utils/settingAnchor";
import { ROAM_DOCS, withDocsLink } from "./utils/docs";

const enum RelationMigrationDialog {
  "none",
  "activate",
  "deactivate",
  "reactivate",
}

const PreferencesGeneral = ({
  onloadArgs,
  globalSettings,
  personalSettings,
}: {
  onloadArgs: OnloadArgs;
  globalSettings: SettingsSnapshot["globalSettings"];
  personalSettings: SettingsSnapshot["personalSettings"];
}) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const legacyBlocks = useLegacyConfigBlocks();
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
      <Label {...settingAnchor([PERSONAL_KEYS.nodeSearchMenuTrigger])}>
        Node search menu trigger
        <Description description="Set the trigger character for the node search menu." />
        <NodeSearchMenuTriggerSetting
          onloadArgs={onloadArgs}
          initialValue={personalSettings[PERSONAL_KEYS.nodeSearchMenuTrigger]}
        />
      </Label>
      <PersonalFlagPanel
        title="Text selection popup"
        description={withDocsLink(
          "Whether or not to show the discourse node menu when selecting text.",
          ROAM_DOCS.creatingNodes,
        )}
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
        title="Enable stored relations"
        description={withDocsLink(
          "Use stored relations instead of legacy pattern-based relations",
          ROAM_DOCS.migrationToStoredRelations,
        )}
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
      <SettingsGroup title="Node trigger">
        <GlobalTextPanel
          title="Graph-wide default"
          description={withDocsLink(
            "The trigger to create the node menu.",
            ROAM_DOCS.creatingNodes,
          )}
          settingKeys={[GLOBAL_KEYS.trigger]}
          initialValue={globalSettings[GLOBAL_KEYS.trigger]}
          {...legacyBlocks.trigger}
        />
        <Label {...settingAnchor([PERSONAL_KEYS.personalNodeMenuTrigger])}>
          Personal override
          <Description
            description={withDocsLink(
              "Override the global trigger for the discourse node menu.",
              ROAM_DOCS.creatingNodes,
            )}
          />
          <NodeMenuTriggerComponent
            extensionAPI={extensionAPI}
            initialValue={
              personalSettings[PERSONAL_KEYS.personalNodeMenuTrigger]
            }
            placeholder=""
          />
        </Label>
      </SettingsGroup>
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

export default PreferencesGeneral;
