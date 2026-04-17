import React, { useState, useEffect } from "react";
import {
  Button,
  HTMLTable,
  Alert,
  Intent,
  Label,
  MenuItem,
  Spinner,
  Tab,
  TabId,
  Tabs,
} from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";
import {
  setFeatureFlag,
  getFeatureFlag,
  isSyncEnabled,
  type SettingsSnapshot,
} from "~/components/settings/utils/accessors";
import {
  getSupabaseContext,
  getLoggedInClient,
  SupabaseContext,
} from "~/utils/supabaseContext";
import {
  getConcepts,
  getSchemaConcepts,
  nodeSchemaSignature,
  type NodeSignature,
  type PConceptFull,
} from "@repo/database/lib/queries";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import internalError from "~/utils/internalError";
import SuggestiveModeSettings from "./SuggestiveModeSettings";
import { FeatureFlagPanel } from "./components/BlockPropSettingPanels";
import type { FeatureFlags } from "./utils/zodSchema";

const NodeRow = ({ node }: { node: PConceptFull }) => {
  return (
    <tr>
      <td>{node.name}</td>
      <td>{node.created}</td>
      <td>{node.last_modified}</td>
      <td>
        <pre>{JSON.stringify({ ...node, Content: null }, null, 2)}</pre>
      </td>
      <td>
        <pre>
          {JSON.stringify({ ...node.Content, Document: null }, null, 2)}
        </pre>
        <span
          data-link-title={node.Content?.text}
          data-link-uid={node.Content?.source_local_id}
        >
          <span className="rm-page-ref__brackets">[[</span>
          <span
            className="rm-page-ref rm-page-ref--link"
            onClick={(event) => {
              void (async (event) => {
                if (event.shiftKey) {
                  if (node.Content?.source_local_id) {
                    await window.roamAlphaAPI.ui.rightSidebar.addWindow({
                      window: {
                        // @ts-expect-error TODO: fix this
                        "block-uid": node.Content.source_local_id,
                        type: "outline",
                      },
                    });
                  }
                } else if (node.Content?.Document?.source_local_id) {
                  await window.roamAlphaAPI.ui.mainWindow.openPage({
                    page: {
                      uid: node.Content.Document.source_local_id,
                    },
                  });
                }
              })(event);
            }}
          >
            {node.Content?.text}
          </span>
          <span className="rm-page-ref__brackets">]]</span>
        </span>
      </td>
      <td>
        <pre>{JSON.stringify(node.Content?.Document, null, 2)}</pre>
      </td>
    </tr>
  );
};

const NodeTable = ({ nodes }: { nodes: PConceptFull[] }) => {
  return (
    <HTMLTable>
      <thead>
        <tr>
          <th>Name</th>
          <th>Created</th>
          <th>Last Modified</th>
          <th>Concept</th>
          <th>Content</th>
          <th>Document</th>
        </tr>
      </thead>
      <tbody>
        {nodes.map((node: PConceptFull) => (
          <NodeRow node={node} key={node.id} />
        ))}
      </tbody>
    </HTMLTable>
  );
};

const NodeListTab = (): React.ReactElement => {
  const [context, setContext] = useState<SupabaseContext | null>(null);
  const [supabase, setSupabase] = useState<DGSupabaseClient | null>(null);
  const [schemas, setSchemas] = useState<NodeSignature[]>([]);
  const [showingSchema, setShowingSchema] =
    useState<NodeSignature>(nodeSchemaSignature);
  const [nodes, setNodes] = useState<PConceptFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let ignore = false;
    void (async () => {
      try {
        if (!ignore) {
          setContext(await getSupabaseContext());
        }
        // Ask for logged-in client _after_ the context
        if (!ignore) {
          setSupabase(await getLoggedInClient());
        }
      } catch (e) {
        setError((e as Error).message);
        console.error("AdminPanel init failed", e);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (!ignore && supabase !== null && context !== null) {
        try {
          setSchemas(await getSchemaConcepts(supabase, context.spaceId));
        } catch (e) {
          setError((e as Error).message);
          console.error("getSchemaConcepts failed", e);
        } finally {
          setLoading(false);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [supabase, context]);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (
        !ignore &&
        schemas !== null &&
        supabase !== null &&
        context !== null
      ) {
        const spaceId = context.spaceId;
        try {
          setLoadingNodes(true);
          setNodes(
            await getConcepts({
              supabase,
              spaceId,
              scope: {
                schemas:
                  showingSchema.sourceLocalId ===
                  nodeSchemaSignature.sourceLocalId,
                type: "nodes",
                ofTypes: [showingSchema.sourceLocalId],
              },
            }),
          );
        } catch (e) {
          setError((e as Error).message);
          console.error("getConcepts failed", e);
        } finally {
          setLoadingNodes(false);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [schemas, showingSchema, context, supabase]);

  if (loading) {
    return (
      <div className="p-3">
        <Spinner />
        <span className="mx-2">Loading admin data…</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-700">{error}</p>;
  }

  return (
    <>
      <p>
        Context:{" "}
        <code>{JSON.stringify({ ...context, spacePassword: "****" })}</code>
      </p>
      {schemas.length > 0 ? (
        <>
          <Label>
            Display:
            <div className="mx-2 inline-block">
              <Select
                items={schemas}
                onItemSelect={(choice) => {
                  setShowingSchema(choice);
                }}
                itemRenderer={(node, { handleClick, modifiers }) => (
                  <MenuItem
                    active={modifiers.active}
                    key={node.sourceLocalId}
                    label={node.name}
                    onClick={handleClick}
                    text={node.name}
                  />
                )}
              >
                <Button text={showingSchema.name} />
              </Select>
            </div>
          </Label>
          <div>{loadingNodes ? <Spinner /> : <NodeTable nodes={nodes} />}</div>
        </>
      ) : (
        <p>No node schemas found</p>
      )}
    </>
  );
};

const FeatureFlagsTab = (): React.ReactElement => {
  const [isConsentAlertOpen, setIsConsentAlertOpen] = useState(false);
  const [isInstructionAlertOpen, setIsInstructionAlertOpen] = useState(false);
  const [isFirstSyncEnable, setIsFirstSyncEnable] = useState(false);
  const [pendingFeatureKey, setPendingFeatureKey] = useState<
    keyof FeatureFlags | null
  >(null);
  const [duplicateNodeAlertValue, setDuplicateNodeAlertValue] = useState(
    getFeatureFlag("Duplicate node alert enabled"),
  );
  const [suggestiveOverlayValue, setSuggestiveOverlayValue] = useState(
    getFeatureFlag("Suggestive mode overlay enabled"),
  );

  const syncAlreadyEnabled = duplicateNodeAlertValue || suggestiveOverlayValue;

  const ensureSyncEnabled = (
    featureKey: keyof FeatureFlags,
  ): Promise<boolean> => {
    if (syncAlreadyEnabled) {
      return Promise.resolve(true);
    }
    setPendingFeatureKey(featureKey);
    setIsConsentAlertOpen(true);
    return Promise.resolve(false);
  };

  const handleFeatureToggled = (
    checked: boolean,
    setter: (v: boolean) => void,
  ) => {
    setter(checked);
    if (checked) {
      setIsInstructionAlertOpen(true);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <FeatureFlagPanel
        title="Duplicate node alert"
        description="Show possible duplicate nodes when viewing a discourse node page."
        featureKey="Duplicate node alert enabled"
        value={duplicateNodeAlertValue}
        onBeforeEnable={() => ensureSyncEnabled("Duplicate node alert enabled")}
        onAfterChange={(checked) =>
          handleFeatureToggled(checked, setDuplicateNodeAlertValue)
        }
      />

      <FeatureFlagPanel
        title="Suggestive mode overlay"
        description="Overlay suggestive mode button over discourse node references."
        featureKey="Suggestive mode overlay enabled"
        value={suggestiveOverlayValue}
        onBeforeEnable={() =>
          ensureSyncEnabled("Suggestive mode overlay enabled")
        }
        onAfterChange={(checked) =>
          handleFeatureToggled(checked, setSuggestiveOverlayValue)
        }
      />

      <Alert
        isOpen={isConsentAlertOpen}
        onConfirm={() => {
          if (pendingFeatureKey) {
            setFeatureFlag(pendingFeatureKey, true);
            if (pendingFeatureKey === "Duplicate node alert enabled") {
              setDuplicateNodeAlertValue(true);
            } else if (
              pendingFeatureKey === "Suggestive mode overlay enabled"
            ) {
              setSuggestiveOverlayValue(true);
            }
          }
          setIsConsentAlertOpen(false);
          setIsFirstSyncEnable(true);
          setIsInstructionAlertOpen(true);
        }}
        onCancel={() => {
          setPendingFeatureKey(null);
          setIsConsentAlertOpen(false);
        }}
        canEscapeKeyCancel={true}
        canOutsideClickCancel={true}
        intent={Intent.PRIMARY}
        confirmButtonText="Enable"
        cancelButtonText="Cancel"
      >
        <p>
          Enabling this feature will send your data (nodes) to our servers and
          OpenAI servers to generate embeddings and suggestions.
        </p>
        <p>Are you sure you want to proceed?</p>
      </Alert>

      <Alert
        isOpen={isInstructionAlertOpen}
        onConfirm={() => window.location.reload()}
        onCancel={() => {
          setIsInstructionAlertOpen(false);
          setIsFirstSyncEnable(false);
        }}
        confirmButtonText="Reload Graph"
        cancelButtonText="Later"
        intent={Intent.PRIMARY}
      >
        <p>Please reload the graph for this change to take effect.</p>
        {isFirstSyncEnable && (
          <>
            <p>
              If this is the first time enabling sync, you will need to generate
              and upload all node embeddings.
            </p>
            <p>
              After reloading, go to Sync mode{" "}
              {
                "-> Sync config -> Click on 'Generate & Upload All Node Embeddings'"
              }
            </p>
          </>
        )}
      </Alert>

      <FeatureFlagPanel
        title="Use new settings store"
        description="When enabled, accessor getters read from block props instead of the old system. Surfaces dual-write gaps during development."
        featureKey="Use new settings store"
      />

      <Button
        className="w-96"
        icon="send-message"
        onClick={() => {
          console.log("sending error email");
          internalError({
            error: new Error("test"),
            type: "Test",
            sendEmail: true,
            forceSendInDev: true,
          });
        }}
      >
        Send Error Email
      </Button>
    </div>
  );
};

const AdminPanel = ({
  globalSettings,
}: {
  globalSettings: SettingsSnapshot["globalSettings"];
}): React.ReactElement => {
  const [selectedTabId, setSelectedTabId] = useState<TabId>("admin");

  return (
    <Tabs
      onChange={(id) => setSelectedTabId(id)}
      selectedTabId={selectedTabId}
      renderActiveTabPanelOnly={true}
    >
      <Tab
        id="admin"
        title="Admin"
        panel={
          <div className="flex flex-col gap-4 p-1">
            <FeatureFlagsTab />
          </div>
        }
      />
      <Tab
        id="node-list"
        title="Node list"
        panel={
          <div className="flex flex-col gap-4 p-1">
            <NodeListTab />
          </div>
        }
      />
      {isSyncEnabled() && (
        <Tab
          id="sync-mode-settings"
          title="Sync mode"
          className="overflow-y-auto"
          panel={<SuggestiveModeSettings globalSettings={globalSettings} />}
        />
      )}
    </Tabs>
  );
};

export default AdminPanel;
