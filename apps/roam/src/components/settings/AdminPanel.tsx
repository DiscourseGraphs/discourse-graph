import React, { useState, useEffect, useMemo } from "react";
import {
  Button,
  Checkbox,
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
import Description from "roamjs-components/components/Description";
import { Select } from "@blueprintjs/select";
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
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import { setFeatureFlag } from "~/components/settings/utils/accessors";

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
  const settings = useMemo(() => {
    refreshConfigTree();
    return getFormattedConfigTree();
  }, []);

  const [suggestiveModeEnabled, setSuggestiveModeEnabled] = useState(
    settings.suggestiveModeEnabled.value || false,
  );
  const [suggestiveModeUid, setSuggestiveModeUid] = useState(
    settings.suggestiveModeEnabled.uid,
  );
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isInstructionOpen, setIsInstructionOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Checkbox
        checked={suggestiveModeEnabled}
        onChange={(e) => {
          const checked = (e.target as HTMLInputElement).checked;
          if (checked) {
            setIsAlertOpen(true);
          } else {
            if (suggestiveModeUid) {
              void deleteBlock(suggestiveModeUid);
              setSuggestiveModeUid(undefined);
            }
            setSuggestiveModeEnabled(false);
            setFeatureFlag("Suggestive mode enabled", false);
          }
        }}
        labelElement={
          <>
            (BETA) Suggestive mode enabled
            <Description
              description={
                "Whether or not to enable the suggestive mode, if this is first time enabling it, you will need to generate and upload all node embeddings to supabase. Go to Suggestive Mode -> Sync Config -> Click on 'Generate & Upload All Node Embeddings'"
              }
            />
          </>
        }
      />
      <Alert
        isOpen={isAlertOpen}
        onConfirm={() => {
          void createBlock({
            parentUid: settings.settingsUid,
            node: { text: "(BETA) Suggestive Mode Enabled" },
          }).then((uid) => {
            setSuggestiveModeUid(uid);
            setSuggestiveModeEnabled(true);
            setFeatureFlag("Suggestive mode enabled", true);
            setIsAlertOpen(false);
            setIsInstructionOpen(true);
          });
        }}
        onCancel={() => setIsAlertOpen(false)}
        canEscapeKeyCancel={true}
        canOutsideClickCancel={true}
        intent={Intent.PRIMARY}
        confirmButtonText="Enable"
        cancelButtonText="Cancel"
      >
        <p>
          Enabling Suggestive Mode will send your data (nodes) to our servers
          and OpenAI servers to generate embeddings and suggestions.
        </p>
        <p>Are you sure you want to proceed?</p>
      </Alert>

      <Alert
        isOpen={isInstructionOpen}
        onConfirm={() => window.location.reload()}
        onCancel={() => setIsInstructionOpen(false)}
        confirmButtonText="Reload Graph"
        cancelButtonText="Later"
        intent={Intent.PRIMARY}
      >
        <p>
          If this is the first time enabling it, you will need to generate and
          upload all node embeddings to supabase.
        </p>
        <p>
          Please reload the graph to see the new &apos;Suggestive Mode&apos;
          tab.
        </p>
        <p>
          Then go to Suggestive Mode{" "}
          {"-> Sync Config -> Click on 'Generate & Upload All Node Embeddings'"}
        </p>
      </Alert>

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

const AdminPanel = (): React.ReactElement => {
  const [selectedTabId, setSelectedTabId] = useState<TabId>("admin");
  const settings = useMemo(() => {
    refreshConfigTree();
    return getFormattedConfigTree();
  }, []);

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
      {settings.suggestiveModeEnabled.value && (
        <Tab
          id="suggestive-mode-settings"
          title="Suggestive mode"
          className="overflow-y-auto"
          panel={<SuggestiveModeSettings />}
        />
      )}
    </Tabs>
  );
};

export default AdminPanel;
