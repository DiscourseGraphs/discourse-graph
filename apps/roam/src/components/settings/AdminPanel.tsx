import React, { useState, useEffect } from "react";
import {
  Button,
  Checkbox,
  HTMLTable,
  Label,
  MenuItem,
  Spinner,
  Tab,
  TabId,
  Tabs,
} from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types";
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
import { DGSupabaseClient } from "@repo/database/lib/client";

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

const AdminPanel = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const [context, setContext] = useState<SupabaseContext | null>(null);
  const [supabase, setSupabase] = useState<DGSupabaseClient | null>(null);
  const [schemas, setSchemas] = useState<NodeSignature[]>([]);
  const [showingSchema, setShowingSchema] =
    useState<NodeSignature>(nodeSchemaSignature);
  const [nodes, setNodes] = useState<PConceptFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<TabId>("admin");

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
            <Checkbox
              defaultChecked={
                extensionAPI.settings.get("use-reified-relations") as boolean
              }
              onChange={(e) => {
                const target = e.target as HTMLInputElement;
                void extensionAPI.settings.set(
                  "use-reified-relations",
                  target.checked,
                );
              }}
              labelElement={
                <>
                  Reified Relation Triples
                  <Description
                    description={
                      "When ON, relations are read/written as sourceUid:relationBlockUid:destinationUid in [[roam/js/discourse-graph/relations]]."
                    }
                  />
                </>
              }
            />
          </div>
        }
      />
      <Tab
        id="node-list"
        title="Node list"
        panel={
          <>
            <p>
              Context:{" "}
              <code>
                {JSON.stringify({ ...context, spacePassword: "****" })}
              </code>
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
                <div>
                  {loadingNodes ? <Spinner /> : <NodeTable nodes={nodes} />}
                </div>
              </>
            ) : (
              <p>No node schemas found</p>
            )}
          </>
        }
      />
    </Tabs>
  );
};

export default AdminPanel;
