import React, { useState, useEffect, useRef } from "react";
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
import migrateRelations from "~/utils/migrateRelations";
import { countReifiedRelations } from "~/utils/createReifiedBlock";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import internalError from "~/utils/internalError";
import SuggestiveModeSettings from "./SuggestiveModeSettings";
import { BlockPropFeatureFlagPanel } from "./components/BlockPropFeatureFlagPanel";
import { useFeatureFlag } from "./utils/hooks";

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

const MigrationTab = (): React.ReactElement => {
  let initial = true;
  const [useMigrationResults, setMigrationResults] = useState<string>("");
  const [useOngoing, setOngoing] = useState<boolean>(false);
  const [useDryRun, setDryRun] = useState<boolean>(false);
  const enabled = useFeatureFlag("Reified Relation Triples");
  const doMigrateRelations = async () => {
    setOngoing(true);
    try {
      const before = await countReifiedRelations();
      const numProcessed = await migrateRelations(useDryRun);
      const after = await countReifiedRelations();
      if (after - before < numProcessed)
        setMigrationResults(
          `${after - before} new relations created out of ${numProcessed} distinct relations processed`,
        );
      else setMigrationResults(`${numProcessed} new relations created`);
    } catch (e) {
      console.error("Relation migration failed", e);
      setMigrationResults(
        `Migration failed: ${(e as Error).message ?? "see console for details"}`,
      );
    } finally {
      setOngoing(false);
    }
  };
  useEffect(() => {
    void (async () => {
      if (initial) {
        const numRelations = await countReifiedRelations();
        setMigrationResults(
          numRelations > 0
            ? `${numRelations} already migrated`
            : "No migrated relations",
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
        initial = false;
      }
    })();
    return () => {
      initial;
    };
  }, []);

  return (
    <>
      <p>
        <Button
          className="p-4"
          onClick={() => {
            void doMigrateRelations();
          }}
          disabled={!enabled || useOngoing}
          text="Migrate all relations"
        ></Button>
        <Checkbox
          className="left-6 inline-block"
          defaultChecked={useDryRun}
          onChange={(e) => {
            const target = e.target as HTMLInputElement;
            setDryRun(target.checked);
          }}
          labelElement={<>Dry run</>}
        />
      </p>
      {useOngoing ? (
        <Spinner />
      ) : (
        <p id="migrationResultsLabel">{useMigrationResults}</p>
      )}
    </>
  );
};

const FeatureFlagsTab = (): React.ReactElement => {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isInstructionOpen, setIsInstructionOpen] = useState(false);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const handleSuggestiveModeBeforeEnable = (): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setIsAlertOpen(true);
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <BlockPropFeatureFlagPanel
        title="(BETA) Suggestive Mode Enabled"
        description="Whether or not to enable the suggestive mode, if this is first time enabling it, you will need to generate and upload all node embeddings to supabase. Go to Suggestive Mode -> Sync Config -> Click on 'Generate & Upload All Node Embeddings'"
        featureKey="Suggestive Mode Enabled"
        onBeforeEnable={handleSuggestiveModeBeforeEnable}
        onAfterChange={(checked) => {
          if (checked) setIsInstructionOpen(true);
        }}
      />
      <Alert
        isOpen={isAlertOpen}
        onConfirm={() => {
          confirmResolverRef.current?.(true);
          confirmResolverRef.current = null;
          setIsAlertOpen(false);
        }}
        onCancel={() => {
          confirmResolverRef.current?.(false);
          confirmResolverRef.current = null;
          setIsAlertOpen(false);
        }}
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
        onConfirm={() => setIsInstructionOpen(false)}
        onCancel={() => setIsInstructionOpen(false)}
        confirmButtonText="Got it"
        intent={Intent.PRIMARY}
      >
        <p>
          If this is the first time enabling it, you will need to generate and
          upload all node embeddings to supabase.
        </p>
        <p>
          Go to the new &apos;Suggestive Mode&apos; tab, then Sync Config{" "}
          {"-> Click on 'Generate & Upload All Node Embeddings'"}
        </p>
      </Alert>

      <BlockPropFeatureFlagPanel
        title="Reified Relation Triples"
        description="When ON, relations are read/written as reifiedRelationUid in [[roam/js/discourse-graph/relations]]."
        featureKey="Reified Relation Triples"
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

const AdminPanel = (): React.ReactElement => {
  const [selectedTabId, setSelectedTabId] = useState<TabId>("admin");
  const suggestiveModeEnabled = useFeatureFlag("Suggestive Mode Enabled");

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
        id="migration"
        title="Migration"
        panel={
          <div className="flex flex-col gap-4 p-1">
            <MigrationTab />
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
      {suggestiveModeEnabled && (
        <Tab
          id="suggestive-mode-settings"
          title="Suggestive Mode"
          className="overflow-y-auto"
          panel={<SuggestiveModeSettings />}
        />
      )}
    </Tabs>
  );
};

export default AdminPanel;
