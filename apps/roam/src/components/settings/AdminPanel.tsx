import React, { useState, useMemo } from "react";
import type { OnloadArgs } from "roamjs-components/types";
import { HTMLTable, Button, MenuItem } from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";
import {
  getSupabaseContext,
  getLoggedInClient,
  SupabaseContext,
} from "~/utils/supabaseContext";
import type { Tables } from "@repo/database/dbTypes";
import {
  getNodes,
  getNodeSchemas,
  nodeSchemaSignature,
  type NodeSignature,
  type PConcept,
} from "@repo/database/lib/queries";
import { DGSupabaseClient } from "@repo/database/lib/client";

type AdminPanelProps = {
  onloadArgs: OnloadArgs;
};

type AdminPanelState = {
  context: SupabaseContext | null;
  supabase: DGSupabaseClient | null;
  schemas: NodeSignature[];
  showingSchema: NodeSignature;
  nodes: PConcept[];
};

const defaultState: AdminPanelState = {
  context: null,
  supabase: null,
  schemas: [],
  showingSchema: nodeSchemaSignature,
  nodes: [],
};

class AdminPanel extends React.Component<AdminPanelProps, AdminPanelState> {
  constructor(props: AdminPanelProps) {
    super(props);
    this.state = defaultState;
  }

  async componentDidMount() {
    try {
      const context = await getSupabaseContext();
      this.setState({ ...this.state, context });
      if (context) {
        const spaceId = context.spaceId;
        const supabase = await getLoggedInClient();
        if (supabase) {
          const schemas = await getNodeSchemas(supabase, spaceId);
          const nodes = await getNodes({ supabase, spaceId });
          this.setState({
            context,
            supabase,
            schemas,
            nodes,
            showingSchema: nodeSchemaSignature,
          });
        }
      }
    } catch (e) {
      console.error("AdminPanel init failed", e);
    }
  }

  render() {
    return (
      <div>
        <p>
          Context:{" "}
          <code>
            {JSON.stringify({ ...this.state.context, spacePassword: "****" })}
          </code>
        </p>
        {Object.keys(this.state.schemas).length > 0 ? (
          <div>
            <div>
              <Select
                items={this.state.schemas}
                onItemSelect={(choice) => {
                  this.setState({ ...this.state, showingSchema: choice });
                  if (
                    this.state.supabase !== null &&
                    this.state.context !== null
                  )
                    getNodes({
                      supabase: this.state.supabase,
                      spaceId: this.state.context.spaceId,
                      schemaLocalIds: choice.sourceLocalId,
                    }).then((nodes) => this.setState({ ...this.state, nodes }));
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
                <Button text={`display: ${this.state.showingSchema.name}`} />
              </Select>
            </div>
            <div>
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
                  {this.state.nodes.map((node: PConcept) => (
                    <tr key={node.id}>
                      <td>{node.name}</td>
                      <td>{node.created}</td>
                      <td>{node.last_modified}</td>
                      <td>
                        <pre>
                          {JSON.stringify({ ...node, Content: null }, null, 2)}
                        </pre>
                      </td>
                      <td>
                        <pre>
                          {JSON.stringify(
                            { ...node.Content, Document: null },
                            null,
                            2,
                          )}
                        </pre>
                        <span
                          data-link-title={node.Content?.text}
                          data-link-uid={node.Content?.source_local_id}
                        >
                          <span className="rm-page-ref__brackets">[[</span>
                          <span
                            className="rm-page-ref rm-page-ref--link"
                            onClick={async (event) => {
                              if (event.shiftKey) {
                                if (node.Content?.source_local_id) {
                                  await window.roamAlphaAPI.ui.rightSidebar.addWindow(
                                    {
                                      window: {
                                        // @ts-expect-error TODO: fix this
                                        "block-uid":
                                          node.Content.source_local_id,
                                        type: "outline",
                                      },
                                    },
                                  );
                                }
                              } else if (
                                node.Content?.Document?.source_local_id
                              ) {
                                window.roamAlphaAPI.ui.mainWindow.openPage({
                                  page: {
                                    uid: node.Content.Document.source_local_id,
                                  },
                                });
                              }
                            }}
                          >
                            {node.Content?.text}
                          </span>
                          <span className="rm-page-ref__brackets">]]</span>
                        </span>
                      </td>
                      <td>
                        <pre>
                          {JSON.stringify(node.Content?.Document, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </HTMLTable>
            </div>
          </div>
        ) : (
          <p>No node schemas found</p>
        )}
      </div>
    );
  }
}

export default AdminPanel;
