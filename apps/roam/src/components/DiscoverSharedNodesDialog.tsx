import {
  Button,
  Callout,
  Classes,
  Dialog,
  HTMLTable,
  InputGroup,
  Intent,
  NonIdealState,
  Spinner,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import {
  discoverSharedNodes,
  type DiscoveredSharedNode,
} from "~/utils/discoverSharedNodes";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";

const formatModifiedAt = (modifiedAt: string): string =>
  new Date(modifiedAt).toLocaleString();

const SharedNodeRow = ({ node }: { node: DiscoveredSharedNode }) => (
  <tr>
    <td>
      <Tag minimal>{node.sourceApp}</Tag>
    </td>
    <td>
      <div
        style={{ maxWidth: "13rem", overflowWrap: "anywhere", fontWeight: 500 }}
      >
        {node.sourceSpaceName}
      </div>
      <div
        className={[Classes.MONOSPACE_TEXT, Classes.TEXT_MUTED].join(" ")}
        style={{
          maxWidth: "13rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: "0.75rem",
        }}
        title={node.sourceSpaceId}
      >
        {node.sourceSpaceId}
      </div>
    </td>
    <td>
      <div
        style={{ maxWidth: "18rem", overflowWrap: "anywhere", fontWeight: 500 }}
      >
        {node.title}
      </div>
    </td>
    <td>
      {node.sourceNodeId ? (
        <div
          className={Classes.MONOSPACE_TEXT}
          style={{
            maxWidth: "11rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: "0.75rem",
          }}
          title={node.sourceNodeRid}
        >
          {node.sourceNodeId}
        </div>
      ) : (
        <span className={Classes.TEXT_MUTED}>Not provided</span>
      )}
    </td>
    <td style={{ whiteSpace: "nowrap" }} title={node.modifiedAt}>
      {formatModifiedAt(node.modifiedAt)}
    </td>
    <td>
      {node.alreadyImported ? (
        <Tag intent={Intent.SUCCESS} minimal>
          Imported
        </Tag>
      ) : (
        <Tag minimal>Available</Tag>
      )}
    </td>
  </tr>
);

const DiscoverSharedNodesDialog = ({ onClose }: { onClose: () => void }) => {
  const [nodes, setNodes] = useState<DiscoveredSharedNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadNodes = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const [client, context] = await Promise.all([
        getLoggedInClient(),
        getSupabaseContext(),
      ]);
      if (!client || !context)
        throw new Error("Could not connect to shared persistence.");
      setNodes(
        await discoverSharedNodes({
          client,
          currentSpaceId: context.spaceId,
        }),
      );
    } catch (loadError) {
      console.error("Failed to discover shared nodes:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load shared nodes.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNodes();
  }, [loadNodes]);

  const visibleNodes = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!normalizedSearch) return nodes;
    return nodes.filter((node) =>
      [
        node.sourceApp,
        node.sourceSpaceName,
        node.sourceSpaceId,
        node.title,
        node.sourceNodeId,
      ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch)),
    );
  }, [nodes, search]);

  return (
    <Dialog
      canEscapeKeyClose
      canOutsideClickClose
      style={{ width: "min(68rem, calc(100vw - 2rem))" }}
      isOpen
      onClose={onClose}
      title="Discover shared nodes"
    >
      <div
        className={Classes.DIALOG_BODY}
        style={{
          display: "flex",
          minHeight: "18rem",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <InputGroup
            style={{ minWidth: 0, flex: 1 }}
            leftIcon="search"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setSearch(event.target.value)
            }
            placeholder="Search shared nodes"
            value={search}
          />
          <Tooltip content="Reload shared nodes">
            <Button
              aria-label="Reload shared nodes"
              disabled={loading}
              icon="refresh"
              minimal
              onClick={() => void loadNodes()}
            />
          </Tooltip>
        </div>

        {loading ? (
          <div
            style={{
              display: "flex",
              minHeight: "13rem",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Spinner />
          </div>
        ) : error ? (
          <Callout intent={Intent.DANGER} title="Could not load shared nodes">
            <div style={{ marginBottom: "0.75rem" }}>{error}</div>
            <Button icon="refresh" onClick={() => void loadNodes()}>
              Try again
            </Button>
          </Callout>
        ) : visibleNodes.length === 0 ? (
          <div
            style={{
              display: "flex",
              minHeight: "13rem",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <NonIdealState
              icon="search"
              title={search ? "No matching shared nodes" : "No shared nodes"}
            />
          </div>
        ) : (
          <div style={{ minHeight: 0, overflow: "auto" }}>
            <HTMLTable striped style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Source app</th>
                  <th>Source space</th>
                  <th>Title</th>
                  <th>Source ID</th>
                  <th>Modified</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleNodes.map((node) => (
                  <SharedNodeRow key={node.sourceNodeRid} node={node} />
                ))}
              </tbody>
            </HTMLTable>
          </div>
        )}
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span className={Classes.TEXT_MUTED} style={{ fontSize: "0.75rem" }}>
            {loading || error
              ? ""
              : `${visibleNodes.length} of ${nodes.length} nodes`}
          </span>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  );
};

type Props = Record<string, never>;

export const renderDiscoverSharedNodesDialog = createOverlayRender<Props>(
  "discourse-discover-shared-nodes",
  DiscoverSharedNodesDialog,
);

export default DiscoverSharedNodesDialog;
