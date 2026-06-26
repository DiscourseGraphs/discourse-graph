import React, { useEffect, useState } from "react";
import {
  Button,
  Callout,
  Classes,
  Dialog,
  Spinner,
  Tag,
} from "@blueprintjs/core";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";
import {
  discoverSharedNodes,
  getMyGroups,
  type DiscoverableGroup,
  type DiscoveredSharedNode,
} from "~/utils/discoverSharedNodes";

/**
 * Source RIDs of shared nodes already imported into this Roam graph. ENG-1855 ships this
 * as an empty seam: Roam has no imported-node store yet (that is ENG-1856), so nothing is
 * marked as imported. ENG-1859 points this at the real reader once ENG-1856 persists
 * imported source identity. See ENG-1855 Decisions in the project worklog.
 */
const getImportedSourceRids = (): Set<string> => new Set<string>();

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      groups: DiscoverableGroup[];
      nodes: DiscoveredSharedNode[];
    };

const formatModified = (iso: string): string => {
  const ms = new Date(iso).valueOf();
  if (Number.isNaN(ms) || ms === 0) return "Unknown";
  return new Date(ms).toLocaleString();
};

const SharedNodeList = ({ nodes }: { nodes: DiscoveredSharedNode[] }) => {
  const bySpace = new Map<
    string,
    {
      sourceApp: DiscoveredSharedNode["sourceApp"];
      nodes: DiscoveredSharedNode[];
    }
  >();
  for (const node of nodes) {
    const existing = bySpace.get(node.sourceSpaceName);
    if (existing) existing.nodes.push(node);
    else
      bySpace.set(node.sourceSpaceName, {
        sourceApp: node.sourceApp,
        nodes: [node],
      });
  }

  return (
    <div className="flex max-h-96 flex-col gap-4 overflow-y-auto">
      {[...bySpace.entries()].map(([spaceName, group]) => (
        <div key={spaceName}>
          <div className="mb-1 flex items-center gap-2">
            <Tag minimal>{group.sourceApp}</Tag>
            <strong>{spaceName}</strong>
          </div>
          <ul className="m-0 list-none p-0">
            {group.nodes.map((node) => (
              <li
                key={node.sourceNodeRid}
                className="flex items-center justify-between gap-2 py-1"
              >
                <span className="truncate">{node.title}</span>
                <span className="flex flex-shrink-0 items-center gap-2">
                  {node.alreadyImported && (
                    <Tag intent="success" minimal>
                      Imported
                    </Tag>
                  )}
                  <span className="text-xs opacity-60">
                    {formatModified(node.sourceModifiedAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

const DiscoverSharedNodesDialog = ({
  isOpen,
  onClose,
}: RoamOverlayProps<Record<string, never>>) => {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const client = await getLoggedInClient();
        if (!client) {
          if (!cancelled)
            setState({
              status: "error",
              message: "Could not access the Discourse Graph database.",
            });
          return;
        }
        const context = await getSupabaseContext();
        if (!context) {
          if (!cancelled)
            setState({
              status: "error",
              message: "Could not load this graph's workspace context.",
            });
          return;
        }
        const [groups, nodes] = await Promise.all([
          getMyGroups(client),
          discoverSharedNodes({
            client,
            currentSpaceId: context.spaceId,
            importedRids: getImportedSourceRids(),
          }),
        ]);
        if (!cancelled) setState({ status: "ready", groups, nodes });
      } catch (error) {
        if (!cancelled)
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unexpected error loading shared nodes.",
          });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Discover shared nodes">
      <div className={Classes.DIALOG_BODY}>
        {state.status === "loading" && (
          <div className="flex items-center gap-2">
            <Spinner size={20} />
            <span>Loading shared nodes…</span>
          </div>
        )}
        {state.status === "error" && (
          <Callout intent="danger" title="Could not load shared nodes">
            {state.message}
          </Callout>
        )}
        {state.status === "ready" &&
          state.groups.length === 0 &&
          state.nodes.length === 0 && (
            <Callout intent="primary" title="No sharing groups">
              You are not a member of any sharing group yet, so there are no
              shared nodes to import.
            </Callout>
          )}
        {state.status === "ready" &&
          state.groups.length > 0 &&
          state.nodes.length === 0 && (
            <Callout intent="primary" title="No shared nodes">
              No shared nodes from other spaces are available to import yet.
            </Callout>
          )}
        {state.status === "ready" && state.nodes.length > 0 && (
          <SharedNodeList nodes={state.nodes} />
        )}
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  );
};

export const renderDiscoverSharedNodesDialog = (): void => {
  renderOverlay({
    id: "discover-shared-nodes",
    Overlay: DiscoverSharedNodesDialog,
  });
};
