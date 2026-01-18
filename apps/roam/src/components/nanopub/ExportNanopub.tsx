import React, { useState, useMemo } from "react";
import {
  Dialog,
  Classes,
  HTMLTable,
  Tag,
  Button,
  Card,
  H2,
  Checkbox,
  Tooltip,
} from "@blueprintjs/core";
import { Result } from "roamjs-components/types/query-builder";
import renderOverlay from "roamjs-components/util/renderOverlay";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getDiscourseNodes, {
  DiscourseNode,
} from "../../utils/getDiscourseNodes";
import findDiscourseNode from "../../utils/findDiscourseNode";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import getBlockProps from "../../utils/getBlockProps";
import { Contributor, NanopubPage } from "./Nanopub";
import NanopubConfigPanel from "./NanopubNodeConfig";
import getSubTree from "roamjs-components/util/getSubTree";
import refreshConfigTree from "../../utils/refreshConfigTree";
import ContributorManager from "./ContributorManager";
import PreviewNanopub from "./PreviewNanopub";
import { OnloadArgs } from "roamjs-components/types";

// TODO
// go over all possible double checks
// eg: ORCID missing

type NodeResult = {
  text: string;
  uid: string;
  node: DiscourseNode;
  nanopub: NanopubPage;
};

const InternalContributorManager = ({ node }: { node: NodeResult }) => {
  const discourseNode = node.node;
  const props = useMemo(
    () => getBlockProps(node.uid) as Record<string, unknown>,
    [node.uid]
  );
  const nanopub = props["nanopub"] as NanopubPage;
  const initialContributors = nanopub?.contributors || [];
  const [contributors, setContributors] =
    useState<Contributor[]>(initialContributors);
  return (
    <ContributorManager
      pageUid={node.uid}
      pageProps={props}
      node={discourseNode.type}
      contributors={contributors}
      setContributors={setContributors}
      handleClose={() => {}}
      requireContributors={discourseNode.nanopub?.requireContributors}
    />
  );
};

const ExportNanopub = ({
  results,
  onClose,
  extensionAPI,
}: {
  results: Result[];
  onClose: () => void;
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [nodes, setNodes] = useState<DiscourseNode[]>(getDiscourseNodes());
  const [viewNanopubConfigNodeType, setViewNanopubConfigNodeType] =
    useState<DiscourseNode | null>(null);
  const [viewContributorsNodeResult, setViewContributorsNodeResult] =
    useState<NodeResult | null>(null);
  const [previewNanopub, setPreviewNanopub] = useState<NodeResult | null>(null);

  const transformResults = (results: Result[]) => {
    const nodes = getDiscourseNodes();
    return results
      .map((r) => {
        const node = findDiscourseNode({ uid: r.uid });
        const props = getBlockProps(r.uid) as Record<string, unknown>;
        const nanopub = props["nanopub"] as NanopubPage;
        return node ? { ...r, node, nanopub } : null;
      })
      .filter((r) => r?.node?.backedBy !== "default")
      .filter((r) => r !== null);
  };

  const [nodeResults, setNodeResults] = useState<NodeResult[]>(
    transformResults(results)
  );

  const checkAndCalcUidsToBePublished = (
    nodeResults: NodeResult[],
    currentUids?: string[]
  ) => {
    const eligibleUids = nodeResults
      .filter((r) => {
        const { nanopub: nanopubSettings } = r.node;
        const { contributors, published } = r.nanopub || {};
        const isEnabled = nanopubSettings?.enabled;
        const hasRequiredContributors =
          !nanopubSettings?.requireContributors ||
          (nanopubSettings.requireContributors && contributors?.length > 0);
        return isEnabled && hasRequiredContributors && !published;
      })
      .map((r) => r.uid);

    if (currentUids) {
      return currentUids.filter((uid) => eligibleUids.includes(uid));
    }

    return eligibleUids;
  };
  const [uidsToBePublished, setUidsToBePublished] = useState<string[]>(
    checkAndCalcUidsToBePublished(nodeResults)
  );

  const refresh = () => {
    refreshConfigTree();
    const newResults = transformResults(results);
    setNodeResults(newResults);
    setUidsToBePublished(
      checkAndCalcUidsToBePublished(newResults, uidsToBePublished)
    );
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        autoFocus={false}
        enforceFocus={false}
        className="w-full sm:w-full md:w-3/4 lg:w-full lg:max-w-7xl bg-white"
        style={{ height: "80vh" }}
      >
        <div
          className={`${Classes.DIALOG_BODY} overflow-y-auto p-1 select-none`}
        >
          {viewNanopubConfigNodeType ? (
            <>
              <div className="mb-4">
                <Button
                  onClick={() => {
                    refresh();
                    setViewNanopubConfigNodeType(null);
                  }}
                  icon={"arrow-left"}
                  text={"Back"}
                  outlined
                />
              </div>
              <H2>{viewNanopubConfigNodeType.text} Nanopub Config</H2>
              <Card>
                <NanopubConfigPanel
                  uid={
                    getSubTree({
                      parentUid: viewNanopubConfigNodeType.type,
                      key: "Nanopub",
                    }).uid
                  }
                  node={viewNanopubConfigNodeType}
                />
              </Card>
            </>
          ) : viewContributorsNodeResult ? (
            <>
              <div className="mb-4">
                <Button
                  onClick={() => {
                    refresh();
                    setViewContributorsNodeResult(null);
                  }}
                  icon={"arrow-left"}
                  text={"Back"}
                  outlined
                />
              </div>
              <H2>Contributors</H2>
              <InternalContributorManager node={viewContributorsNodeResult} />
            </>
          ) : previewNanopub ? (
            <>
              <Button
                onClick={() => setPreviewNanopub(null)}
                icon={"arrow-left"}
                text={"Back"}
                outlined
              />
              <PreviewNanopub
                contributors={previewNanopub.nanopub?.contributors}
                templateTriples={previewNanopub.node.nanopub?.triples}
                discourseNode={previewNanopub.node}
                extensionAPI={extensionAPI}
                pageUid={previewNanopub.uid}
              />
            </>
          ) : (
            <HTMLTable className="w-full" striped>
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Status</th>
                  <th>Config</th>
                  <th>Contributors</th>
                  <th>Preview</th>
                  <th>Publish</th>
                </tr>
              </thead>
              <tbody>
                {nodeResults.map((r) => {
                  const title = getPageTitleByPageUid(r.uid) || "";
                  const nanopubSettings = r.node.nanopub;
                  const nanopubProps = r.nanopub;
                  return (
                    <tr key={r.uid}>
                      <td
                        data-cell-content={title}
                        className="max-w-xs truncate"
                        style={{ verticalAlign: "middle" }}
                      >
                        <a
                          className="rm-page-ref"
                          data-link-title={title}
                          title={title}
                          onMouseDown={(e) => {
                            if (e.shiftKey) {
                              openBlockInSidebar(r.uid);
                              onClose();
                              e.preventDefault();
                              e.stopPropagation();
                            } else {
                              window.roamAlphaAPI.ui.mainWindow.openPage({
                                page: { uid: r.uid },
                              });
                              onClose();
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        >
                          <span>{r.text}</span>
                        </a>
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        {r.nanopub?.published ? (
                          <Tag intent="success">Published</Tag>
                        ) : nanopubSettings?.enabled ? (
                          <Tag>Not Published</Tag>
                        ) : (
                          <Tag intent="warning">Disabled</Tag>
                        )}
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        <Button
                          icon="cog"
                          onClick={() => setViewNanopubConfigNodeType(r.node)}
                        />
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        <Button
                          rightIcon="person"
                          onClick={() => setViewContributorsNodeResult(r)}
                          disabled={!nanopubSettings?.enabled}
                          text={`${nanopubProps?.contributors?.length || 0}`}
                          intent={
                            !nanopubProps?.contributors?.length &&
                            nanopubSettings?.requireContributors &&
                            nanopubSettings.enabled
                              ? "warning"
                              : undefined
                          }
                        />
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        <Button
                          icon="eye-open"
                          disabled={!nanopubSettings?.enabled}
                          onClick={() => setPreviewNanopub(r)}
                        />
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        <Tooltip
                          content={
                            !!nanopubProps?.published
                              ? "Already Published"
                              : !nanopubSettings?.enabled
                              ? "Disabled"
                              : !nanopubProps?.contributors?.length &&
                                nanopubSettings?.requireContributors
                              ? "Requires Contributors"
                              : ""
                          }
                        >
                          <Checkbox
                            checked={uidsToBePublished.includes(r.uid)}
                            onChange={(e) => {
                              const target = e.target as HTMLInputElement;
                              if (target.checked) {
                                setUidsToBePublished([
                                  ...uidsToBePublished,
                                  r.uid,
                                ]);
                              } else {
                                setUidsToBePublished(
                                  uidsToBePublished.filter(
                                    (uid) => uid !== r.uid
                                  )
                                );
                              }
                            }}
                            disabled={
                              !!nanopubProps?.published ||
                              !nanopubSettings?.enabled ||
                              (!nanopubProps?.contributors?.length &&
                                nanopubSettings?.requireContributors)
                            }
                          />
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </HTMLTable>
          )}
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={onClose}>Close</Button>
            <Button
              intent="primary"
              onClick={() => alert("Not yet implemented")}
              disabled={!uidsToBePublished.length}
            >
              Publish {uidsToBePublished.length} Pages
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};

export type ExportNanopubProps = {
  results: Result[];
  onClose: () => void;
  extensionAPI: OnloadArgs["extensionAPI"];
};
export const render = (props: ExportNanopubProps) =>
  renderOverlay({ Overlay: ExportNanopub, props });
