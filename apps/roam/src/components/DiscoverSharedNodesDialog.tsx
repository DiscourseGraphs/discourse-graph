import {
  Button,
  Callout,
  Checkbox,
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
import { importDiscoveredSharedNode } from "~/utils/importDiscoveredSharedNode";
import {
  importSelectedSharedNodes,
  type SelectedSharedNodeImportResult,
} from "~/utils/importSelectedSharedNodes";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";

const formatModifiedAt = (modifiedAt: string): string =>
  new Date(modifiedAt).toLocaleString();

const SharedNodeRow = ({
  disabled,
  node,
  onToggle,
  selected,
}: {
  disabled: boolean;
  node: DiscoveredSharedNode;
  onToggle: (node: DiscoveredSharedNode) => void;
  selected: boolean;
}) => (
  <tr>
    <td>
      <Checkbox
        aria-label={`Select ${node.title}`}
        checked={selected}
        disabled={disabled || node.sourceApp !== "Obsidian"}
        onChange={() => onToggle(node)}
        title={
          node.sourceApp === "Obsidian"
            ? undefined
            : "Only Obsidian-origin nodes can be imported into Roam"
        }
      />
    </td>
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

const ImportResultCallout = ({
  result,
}: {
  result: SelectedSharedNodeImportResult;
}) => {
  const failedCount = result.failed.length;
  const intent =
    failedCount === 0
      ? Intent.SUCCESS
      : result.imported > 0 || result.skipped > 0
        ? Intent.WARNING
        : Intent.DANGER;

  return (
    <Callout
      intent={intent}
      title={`${result.imported} imported, ${result.skipped} skipped, ${failedCount} failed`}
    >
      {result.updated > 0 && (
        <div className={failedCount > 0 ? "mb-2" : undefined}>
          {result.updated} previously imported{" "}
          {result.updated === 1 ? "node was" : "nodes were"} updated.
        </div>
      )}
      {failedCount > 0 && (
        <ul className="m-0 pl-5">
          {result.failed.map(({ message, node }) => (
            <li key={node.sourceNodeRid}>
              <strong>{node.title}:</strong> {message}
            </li>
          ))}
        </ul>
      )}
    </Callout>
  );
};

const DiscoverSharedNodesDialog = ({ onClose }: { onClose: () => void }) => {
  const [nodes, setNodes] = useState<DiscoveredSharedNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] =
    useState<SelectedSharedNodeImportResult>();
  const [search, setSearch] = useState("");
  const [selectedSourceRids, setSelectedSourceRids] = useState<Set<string>>(
    new Set(),
  );

  const loadNodes = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    setImportError("");
    setImportResult(undefined);
    setSelectedSourceRids(new Set());
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

  const selectedNodes = useMemo(
    () => nodes.filter((node) => selectedSourceRids.has(node.sourceNodeRid)),
    [nodes, selectedSourceRids],
  );
  const visibleImportableNodes = useMemo(
    () => visibleNodes.filter((node) => node.sourceApp === "Obsidian"),
    [visibleNodes],
  );
  const allVisibleSelected =
    visibleImportableNodes.length > 0 &&
    visibleImportableNodes.every((node) =>
      selectedSourceRids.has(node.sourceNodeRid),
    );
  const someVisibleSelected = visibleImportableNodes.some((node) =>
    selectedSourceRids.has(node.sourceNodeRid),
  );

  const toggleNode = useCallback((node: DiscoveredSharedNode): void => {
    setSelectedSourceRids((current) => {
      const next = new Set(current);
      if (next.has(node.sourceNodeRid)) next.delete(node.sourceNodeRid);
      else next.add(node.sourceNodeRid);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback((): void => {
    setSelectedSourceRids((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleImportableNodes.forEach((node) =>
          next.delete(node.sourceNodeRid),
        );
      } else {
        visibleImportableNodes.forEach((node) => next.add(node.sourceNodeRid));
      }
      return next;
    });
  }, [allVisibleSelected, visibleImportableNodes]);

  const importSelected = useCallback(async (): Promise<void> => {
    setImporting(true);
    setImportError("");
    setImportResult(undefined);
    try {
      const client = await getLoggedInClient();
      if (!client) throw new Error("Could not connect to shared persistence.");

      const result = await importSelectedSharedNodes({
        materializeNode: (node) => importDiscoveredSharedNode({ client, node }),
        nodes: selectedNodes,
      });
      const failedSourceRids = new Set(
        result.failed.map(({ node }) => node.sourceNodeRid),
      );
      setNodes((current) =>
        current.map((node) =>
          selectedSourceRids.has(node.sourceNodeRid) &&
          !failedSourceRids.has(node.sourceNodeRid)
            ? { ...node, alreadyImported: true }
            : node,
        ),
      );
      setSelectedSourceRids(failedSourceRids);
      setImportResult(result);
    } catch (importError) {
      console.error("Failed to import selected shared nodes:", importError);
      setImportError(
        importError instanceof Error
          ? importError.message
          : "Could not import selected shared nodes.",
      );
    } finally {
      setImporting(false);
    }
  }, [selectedNodes, selectedSourceRids]);

  return (
    <Dialog
      autoFocus={false}
      canEscapeKeyClose={!importing}
      canOutsideClickClose={!importing}
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
              disabled={loading || importing}
              icon="refresh"
              minimal
              onClick={() => void loadNodes()}
            />
          </Tooltip>
        </div>

        {importResult && <ImportResultCallout result={importResult} />}
        {importError && (
          <Callout intent={Intent.DANGER} title="Could not import shared nodes">
            {importError}
          </Callout>
        )}

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
                  <th>
                    <Checkbox
                      aria-label="Select all visible Obsidian nodes"
                      checked={allVisibleSelected}
                      disabled={
                        importing || visibleImportableNodes.length === 0
                      }
                      indeterminate={someVisibleSelected && !allVisibleSelected}
                      onChange={toggleAllVisible}
                    />
                  </th>
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
                  <SharedNodeRow
                    key={node.sourceNodeRid}
                    disabled={importing}
                    node={node}
                    onToggle={toggleNode}
                    selected={selectedSourceRids.has(node.sourceNodeRid)}
                  />
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
              : `${visibleNodes.length} of ${nodes.length} nodes · ${selectedNodes.length} selected`}
          </span>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button disabled={importing} onClick={onClose}>
              Close
            </Button>
            <Button
              disabled={importing || selectedNodes.length === 0}
              intent={Intent.PRIMARY}
              loading={importing}
              onClick={() => void importSelected()}
            >
              Import selected
              {selectedNodes.length > 0 ? ` (${selectedNodes.length})` : ""}
            </Button>
          </div>
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
