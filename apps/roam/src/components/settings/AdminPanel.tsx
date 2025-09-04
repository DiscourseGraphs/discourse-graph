import React, { useState } from "react";
import type { OnloadArgs } from "roamjs-components/types";
import {
  HTMLTable,
  HTMLInputProps,
  HTMLDivProps,
  Button,
  MenuItem,
  InputGroup,
} from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";
import {
  getSupabaseContext,
  getLoggedInClient,
  SupabaseContext,
} from "~/utils/supabaseContext";
import type { Tables } from "@repo/database/dbTypes";

type AdminPanelProps = {
  onloadArgs: OnloadArgs;
};

type NodeSignature = { id: number; name: string };

const nodeSchemaSignature: NodeSignature = { id: 0, name: "Node types" };

type PDocument = Partial<Tables<"Document">>;
type PContent = Partial<Tables<"Content">> & {
  Document: PDocument | null;
};
type PConcept = Partial<Tables<"Concept">> & { Content: PContent | null };

type AdminPanelState = {
  context: SupabaseContext | null;
  schemas: NodeSignature[];
  showingSchema: NodeSignature;
  nodes: PConcept[];
};

const defaultState: AdminPanelState = {
  context: null,
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
        const schemas = await this.getNodeSchemas();
        const nodes = await this.getNodes(0);
        this.setState({
          context,
          schemas,
          nodes,
          showingSchema: nodeSchemaSignature,
        });
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
                  this.getNodes(choice.id).then((nodes) =>
                    this.setState({ ...this.state, nodes }),
                  );
                }}
                itemRenderer={(node, { handleClick, modifiers }) => (
                  <MenuItem
                    active={modifiers.active}
                    key={node.id}
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

  async getNodeSchemas(): Promise<NodeSignature[]> {
    if (!this.state.context?.spaceId) return [];
    const supabase = await getLoggedInClient();
    const res = await supabase
      .from("Concept")
      .select("id,name")
      .eq("space_id", this.state.context.spaceId)
      .eq("is_schema", true)
      .eq("arity", 0);
    if (res.error) {
      console.error("getNodeSchemas failed", res.error);
      return [nodeSchemaSignature];
    }
    return [nodeSchemaSignature, ...(res.data || [])];
  }

  async getNodes(schema: number): Promise<PConcept[]> {
    if (!this.state.context?.spaceId) return [];
    const supabase = await getLoggedInClient();
    let query = supabase
      .from("Concept")
      .select(
        `
          id,
          name,
          description,
          author_id,
          created,
          last_modified,
          space_id,
          arity,
          literal_content,
          reference_content,
          refs,
          is_schema,
          represented_by_id,
          Content (
              id,
              source_local_id,
              variant,
              author_id,
              creator_id,
              created,
              text,
              metadata,
              scale,
              space_id,
              last_modified,
              part_of_id,
              Document (
                  space_id,
                  source_local_id,
                  url,
                  created,
                  metadata,
                  last_modified,
                  author_id
              ))`,
      )
      .eq("space_id", this.state.context.spaceId);
    if (schema > 0) {
      query = query.eq("is_schema", false).eq("schema_id", schema);
    } else {
      query = query.eq("is_schema", true).eq("arity", 0);
    }
    const { error, data } = await query;
    if (error) {
      console.error("getNodes failed", error);
      return [];
    }
    return data || [];
  }
}

export default AdminPanel;
