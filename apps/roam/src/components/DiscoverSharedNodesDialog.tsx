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
      <div className="max-w-52 font-medium [overflow-wrap:anywhere]">
        {node.sourceSpaceName}
      </div>
      <div
        className={[
          Classes.MONOSPACE_TEXT,
          Classes.TEXT_MUTED,
          "max-w-52 truncate text-xs",
        ].join(" ")}
        title={node.sourceSpaceId}
      >
        {node.sourceSpaceId}
      </div>
    </td>
    <td>
      <div className="max-w-72 font-medium [overflow-wrap:anywhere]">
        {node.title}
      </div>
    </td>
    <td>
      {node.sourceNodeId ? (
        <div
          className={[Classes.MONOSPACE_TEXT, "max-w-44 truncate text-xs"].join(
            " ",
          )}
          title={node.sourceNodeRid}
        >
          {node.sourceNodeId}
        </div>
      ) : (
        <span className={Classes.TEXT_MUTED}>Not provided</span>
      )}
    </td>
    <td className="whitespace-nowrap" title={node.modifiedAt}>
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
      autoFocus={false}
      canEscapeKeyClose
      canOutsideClickClose
      enforceFocus={false}
      style={{ width: "min(68rem, calc(100vw - 2rem))" }}
      isOpen
      onClose={onClose}
      title="Discover shared nodes"
    >
      <div
        className={[Classes.DIALOG_BODY, "flex min-h-72 flex-col gap-3"].join(
          " ",
        )}
      >
        <div className="flex items-center gap-2">
          <InputGroup
            className="min-w-0 flex-1"
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
          <div className="flex min-h-52 items-center justify-center">
            <Spinner />
          </div>
        ) : error ? (
          <Callout intent={Intent.DANGER} title="Could not load shared nodes">
            <div className="mb-3">{error}</div>
            <Button icon="refresh" onClick={() => void loadNodes()}>
              Try again
            </Button>
          </Callout>
        ) : visibleNodes.length === 0 ? (
          <div className="flex min-h-52 items-center justify-center">
            <NonIdealState
              icon="search"
              title={search ? "No matching shared nodes" : "No shared nodes"}
            />
          </div>
        ) : (
          <div className="min-h-0 overflow-auto">
            <HTMLTable striped className="w-full">
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
        <div className="flex items-center justify-between">
          <span className={[Classes.TEXT_MUTED, "text-xs"].join(" ")}>
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
