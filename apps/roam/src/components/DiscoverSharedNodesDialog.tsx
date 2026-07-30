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
import {
  importSharedNodes,
  isFailedSharedNodeImport,
  type SharedNodeImportItem,
} from "~/utils/importSharedNodes";
import internalError from "~/utils/internalError";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";

const IMPORT_ERROR_TYPE = "Shared node import failed";
const IMPORT_ERROR_OPERATION = "import-shared-nodes";

const formatModifiedAt = (modifiedAt: string): string =>
  new Date(modifiedAt).toLocaleString();

const isImportableSharedNode = (node: DiscoveredSharedNode): boolean =>
  node.sourceApp === "Obsidian";

const SharedNodeRow = ({
  node,
  selected,
  selectionDisabled,
  onToggleSelected,
}: {
  node: DiscoveredSharedNode;
  selected: boolean;
  selectionDisabled: boolean;
  onToggleSelected: () => void;
}) => (
  <tr>
    <td>
      <Checkbox
        aria-label={`Select ${node.title}`}
        checked={selected}
        className="m-0"
        disabled={selectionDisabled || !isImportableSharedNode(node)}
        onChange={onToggleSelected}
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

const ImportResultsSummary = ({
  results,
}: {
  results: SharedNodeImportItem[];
}) => {
  const importedCount = results.filter(
    (item) => item.status === "imported",
  ).length;
  const skippedCount = results.filter(
    (item) => item.status === "skipped",
  ).length;
  const failedImports = results.filter(isFailedSharedNodeImport);
  return (
    <Callout
      intent={failedImports.length > 0 ? Intent.WARNING : Intent.SUCCESS}
      title={`${importedCount} imported, ${skippedCount} skipped, ${failedImports.length} failed`}
    >
      {skippedCount > 0 && (
        <div>Skipped nodes were already up to date in this graph.</div>
      )}
      {failedImports.length > 0 && (
        <ul className="mb-0 mt-2 list-disc pl-5">
          {failedImports.map((item) => (
            <li key={item.sharedNode.rid}>
              <span className="font-medium">{item.sharedNode.title}</span>:{" "}
              {item.message}
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRids, setSelectedRids] = useState<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [importResults, setImportResults] = useState<
    SharedNodeImportItem[] | null
  >(null);
  const importing = importProgress !== null;

  const loadNodes = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    setSelectedRids(new Set());
    setImportResults(null);
    try {
      const context = await getSupabaseContext();
      if (!context) throw new Error("Could not connect to shared persistence.");
      const client = await getLoggedInClient();
      if (!client) throw new Error("Could not connect to shared persistence.");
      setNodes(
        await discoverSharedNodes({
          client,
          currentSpaceId: context.spaceId,
        }),
      );
    } catch (loadError) {
      internalError({
        error: loadError,
        type: "Shared node discovery failed",
        context: { operation: "load-shared-nodes" },
        sendEmail: false,
      });
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
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
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
  }, [nodes, searchTerm]);

  const importableVisibleRids = visibleNodes
    .filter(isImportableSharedNode)
    .map((node) => node.sourceNodeRid);
  const allVisibleSelected =
    importableVisibleRids.length > 0 &&
    importableVisibleRids.every((rid) => selectedRids.has(rid));
  const someVisibleSelected = importableVisibleRids.some((rid) =>
    selectedRids.has(rid),
  );

  const toggleNodeSelected = (rid: string): void => {
    setSelectedRids((previous) => {
      const next = new Set(previous);
      if (next.has(rid)) next.delete(rid);
      else next.add(rid);
      return next;
    });
  };

  const toggleAllVisibleSelected = (): void => {
    setSelectedRids((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected)
        importableVisibleRids.forEach((rid) => next.delete(rid));
      else importableVisibleRids.forEach((rid) => next.add(rid));
      return next;
    });
  };

  const importSelectedNodes = async (): Promise<void> => {
    const selectedNodes = nodes
      .filter((node) => selectedRids.has(node.sourceNodeRid))
      .map((node) => node.sharedNode);

    setImportResults(null);
    setImportProgress({ current: 0, total: selectedNodes.length });
    try {
      const client = await getLoggedInClient();
      if (!client) throw new Error("Could not connect to shared persistence.");
      const results = await importSharedNodes({
        client,
        sharedNodes: selectedNodes,
        onProgress: (current, total) => setImportProgress({ current, total }),
      });
      setImportResults(results);
      const importedRids = new Set(
        results
          .filter((item) => item.status !== "failed")
          .map((item) => item.sharedNode.rid),
      );
      setNodes((previous) =>
        previous.map((node) =>
          importedRids.has(node.sourceNodeRid)
            ? { ...node, alreadyImported: true }
            : node,
        ),
      );
      const failedImports = results.filter(isFailedSharedNodeImport);
      setSelectedRids(
        new Set(failedImports.map((item) => item.sharedNode.rid)),
      );
      if (failedImports.length > 0) {
        internalError({
          error: new Error(
            `${failedImports.length} of ${results.length} shared node imports failed`,
          ),
          type: IMPORT_ERROR_TYPE,
          context: {
            operation: IMPORT_ERROR_OPERATION,
            failureMessages: failedImports.map((item) => item.message),
          },
          sendEmail: false,
        });
      }
    } catch (importError) {
      internalError({
        error: importError,
        type: IMPORT_ERROR_TYPE,
        context: { operation: IMPORT_ERROR_OPERATION },
        sendEmail: false,
        userMessage:
          importError instanceof Error
            ? importError.message
            : "Could not import the selected shared nodes.",
      });
    } finally {
      setImportProgress(null);
    }
  };

  return (
    <Dialog
      autoFocus={false}
      canEscapeKeyClose={!importing}
      canOutsideClickClose={!importing}
      enforceFocus={false}
      isCloseButtonShown={!importing}
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
              setSearchTerm(event.target.value)
            }
            placeholder="Search shared nodes"
            value={searchTerm}
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

        {importResults && <ImportResultsSummary results={importResults} />}

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
              title={
                searchTerm ? "No matching shared nodes" : "No shared nodes"
              }
            />
          </div>
        ) : (
          <div className="min-h-0 overflow-auto">
            <HTMLTable striped className="w-full">
              <thead>
                <tr>
                  <th>
                    <Checkbox
                      aria-label="Select all importable nodes"
                      checked={allVisibleSelected}
                      className="m-0"
                      disabled={importing || importableVisibleRids.length === 0}
                      indeterminate={!allVisibleSelected && someVisibleSelected}
                      onChange={toggleAllVisibleSelected}
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
                    node={node}
                    onToggleSelected={() =>
                      toggleNodeSelected(node.sourceNodeRid)
                    }
                    selected={selectedRids.has(node.sourceNodeRid)}
                    selectionDisabled={importing}
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
              : `${visibleNodes.length} of ${nodes.length} nodes`}
          </span>
          <div className="flex items-center gap-2">
            <Button disabled={importing} onClick={onClose}>
              Close
            </Button>
            <Button
              disabled={importing || selectedRids.size === 0}
              intent={Intent.PRIMARY}
              onClick={() => void importSelectedNodes()}
            >
              {importProgress
                ? `Importing ${importProgress.current} of ${importProgress.total}…`
                : `Import selected (${selectedRids.size})`}
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
