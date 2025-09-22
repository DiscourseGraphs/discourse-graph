import React, { useState, useEffect } from "react";
import { HTMLTable, Button, MenuItem, Spinner } from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";
import {
  getSupabaseContext,
  getLoggedInClient,
  SupabaseContext,
} from "~/utils/supabaseContext";
import {
  getNodes,
  getNodeSchemas,
  nodeSchemaSignature,
  type NodeSignature,
  type PConcept,
} from "@repo/database/lib/queries";
import { DGSupabaseClient } from "@repo/database/lib/client";

const NodeRow = ({ node }: { node: PConcept }) => {
  return (
    <tr key={node.id}>
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

const NodeTable = ({ nodes }: { nodes: PConcept[] }) => {
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
        {nodes.map((node: PConcept) => (
          <NodeRow node={node} key={node.id} />
        ))}
      </tbody>
    </HTMLTable>
  );
};

const AdminPanel = () => {
  const [context, setContext] = useState<SupabaseContext | null>(null);
  const [supabase, setSupabase] = useState<DGSupabaseClient | null>(null);
  const [schemas, setSchemas] = useState<NodeSignature[]>([]);
  const [showingSchema, setShowingSchema] =
    useState<NodeSignature>(nodeSchemaSignature);
  const [nodes, setNodes] = useState<PConcept[]>([]);
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
        if (!ignore) {
          setSupabase(await getLoggedInClient());
        }
      } catch (e) {
        setError(`${e}`);
        console.error("AdminPanel init failed", e);
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
          setSchemas(await getNodeSchemas(supabase, context.spaceId));
        } catch (e) {
          setError(`${e}`);
          console.error("getNodeSchemas failed", e);
        }
      }
      setLoading(false);
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
            await getNodes({
              supabase,
              spaceId,
              schemaLocalIds: showingSchema.sourceLocalId,
            }),
          );
          setLoadingNodes(false);
        } catch (e) {
          setError(`${e}`);
          console.error("getNodes failed", e);
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
        <span style={{ marginLeft: 8 }}>Loading admin data…</span>
      </div>
    );
  }

  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  return (
    <div>
      <p>
        Context:{" "}
        <code>{JSON.stringify({ ...context, spacePassword: "****" })}</code>
      </p>
      {Object.keys(schemas).length > 0 ? (
        <div>
          <div>
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
              <Button text={`display: ${showingSchema.name}`} />
            </Select>
          </div>
          <div>{loadingNodes ? <Spinner /> : <NodeTable nodes={nodes} />}</div>
        </div>
      ) : (
        <p>No node schemas found</p>
      )}
    </div>
  );
};

export default AdminPanel;
