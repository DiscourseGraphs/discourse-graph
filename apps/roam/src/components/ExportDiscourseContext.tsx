import React, { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  Button,
  Classes,
  Dialog,
  Label,
  Slider,
  Tab,
  Tabs,
  Tooltip,
  Callout,
  Collapse,
  ProgressBar,
  Intent,
} from "@blueprintjs/core";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getLinkedPageTitlesUnderUid from "roamjs-components/queries/getLinkedPageTitlesUnderUid";
import getPageTitlesAndBlockUidsReferencingPage from "roamjs-components/queries/getPageTitlesAndBlockUidsReferencingPage";
import isDiscourseNode from "../utils/isDiscourseNode";
import getDiscourseContextResults from "../utils/getDiscourseContextResults";
import { render as exportRender } from "./Export";
import { Result } from "../utils/types";
import posthog from "posthog-js";

type UpdateProgressWithDelay = (params: {
  progress: number;
  delayAmount?: number;
  message?: string;
  isDiscourse?: boolean;
}) => Promise<void>;

const getInboundReferences = async (uid: string) => {
  // TODO: Optimize this with custom query to take in and return Result[]
  const pageTitle = getPageTitleByPageUid(uid);
  const refs = getPageTitlesAndBlockUidsReferencingPage(pageTitle);
  const refPageUids = refs.map((r) => getPageUidByPageTitle(r.title));
  return refPageUids;
};

const getOutboundReferences = async (uid: string) => {
  // TODO: Optimize this with custom recursive query take in and return Result[]
  // https://github.com/RoamJS/query-builder/pull/165
  const refPageTitles = getLinkedPageTitlesUnderUid(uid);
  const refPageUids = refPageTitles.map((title) =>
    getPageUidByPageTitle(title),
  );
  return refPageUids;
};

const getReferencesByDegree = async (
  initialUids: string[],
  degrees: number,
  getReferences: (uid: string) => Promise<string[]>,
): Promise<Set<string>> => {
  let currentUids = [...initialUids];
  const visitedUids = new Set<string>();

  for (let i = 0; i < degrees; i++) {
    const nextUids = new Set<string>();
    for (let uid of currentUids) {
      const refs = await getReferences(uid);
      refs.forEach((ref) => (!visitedUids.has(ref) ? nextUids.add(ref) : ""));
    }

    nextUids.forEach((uid) => visitedUids.add(uid));
    currentUids = Array.from(nextUids);
  }

  return visitedUids;
};

const getAllReferencesByDegree = async (
  initialUids: string[],
  degreesIn: number,
  degreesOut: number,
): Promise<Set<string>> => {
  const inboundUids = await getReferencesByDegree(
    initialUids,
    degreesIn,
    getInboundReferences,
  );
  const outboundUids = await getReferencesByDegree(
    initialUids,
    degreesOut,
    getOutboundReferences,
  );

  return new Set([...inboundUids, ...outboundUids, ...initialUids]);
};

const getDiscourseContextResultsByDepth = async ({
  uid,
  title,
  currentDepth,
  maxDepth,
  visitedUids,
  updateProgressWithDelay,
  progressRefresh = 0.1,
}: {
  uid: string;
  title?: string;
  currentDepth: number;
  maxDepth: number;
  visitedUids: Set<string>;
  updateProgressWithDelay: UpdateProgressWithDelay;
  progressRefresh?: number;
}) => {
  const initialResult = { uid, text: title || getPageTitleByPageUid(uid) };
  let aggregatedResults: Result[] = [initialResult];

  if (currentDepth >= maxDepth || visitedUids.has(uid)) {
    return aggregatedResults;
  }

  visitedUids.add(uid);

  const discourseContextResults = await getDiscourseContextResults({ uid });
  for (const { results } of discourseContextResults) {
    for (const result in results) {
      await updateProgressWithDelay({
        progress: progressRefresh,
        message: "Processing",
        isDiscourse: true,
      });
      const r = results[result] as Result;
      aggregatedResults.push(r);
      const deeperResults = await getDiscourseContextResultsByDepth({
        uid: r.uid,
        title: r.text,
        currentDepth: currentDepth + 1,
        maxDepth: maxDepth,
        visitedUids,
        updateProgressWithDelay,
        progressRefresh,
      });
      progressRefresh = progressRefresh === 0.9 ? 0.1 : progressRefresh + 0.1;
      aggregatedResults = aggregatedResults.concat(deeperResults);
    }
  }

  return aggregatedResults;
};

const getAllDiscourseContext = async (
  initialUids: string[],
  discourseContextDepth = 1,
  updateProgressWithDelay: UpdateProgressWithDelay,
  visitedUids = new Set<string>(),
) => {
  await updateProgressWithDelay({
    progress: 0.01,
    message: "Gathering Initial Discourse Results",
  });
  const discourseNodeUids = initialUids.filter((uid) => isDiscourseNode(uid));

  const allResults = [];
  for (let i = 0; i < discourseNodeUids.length; i++) {
    const progress = i / discourseNodeUids.length;
    await updateProgressWithDelay({
      progress: progress || 0.01,
      message: `Processing Result ${i + 1} of ${discourseNodeUids.length}`,
    });

    const result = await getDiscourseContextResultsByDepth({
      uid: discourseNodeUids[i],
      currentDepth: 0,
      maxDepth: discourseContextDepth,
      updateProgressWithDelay,
      visitedUids,
    });
    allResults.push(result);
  }

  await updateProgressWithDelay({
    progress: 1,
    isDiscourse: true,
  });
  await updateProgressWithDelay({
    progress: 0.9,
    message: "Cleaning up Results",
  });

  // Remove duplicates
  const flattenedResults = allResults.flat();
  const uidToResultMap = new Map();
  for (const result of flattenedResults) {
    uidToResultMap.set(result.uid, result);
  }
  const uniqueResults: Result[] = [...uidToResultMap.values()];

  return uniqueResults;
};

const getGraphOverviewDepthValues = () => {
  const controlPanelEl = document.querySelector(
    "div.rm-graph-view-control-panel__main-options",
  );
  if (!controlPanelEl) return { degreesIn: 0, degreesOut: 0 };

  const getSliderValueByText = (parentElement: Element, text: string) => {
    const element = Array.from(parentElement.querySelectorAll("strong")).find(
      (el) => el.textContent?.trim() === text,
    );
    if (element) {
      const sliderDiv =
        element.parentElement?.parentElement?.nextElementSibling;
      if (sliderDiv) {
        const sliderLabel = sliderDiv.querySelector(
          ".bp3-slider-handle .bp3-slider-label",
        );
        return sliderLabel ? parseInt(sliderLabel.textContent || "0", 10) : 0;
      }
    }
    return 0;
  };

  const degreesIn = getSliderValueByText(controlPanelEl, "Degrees In");
  const degreesOut = getSliderValueByText(controlPanelEl, "Degrees Out");

  return {
    degreesIn,
    degreesOut,
  };
};

type GraphExportDialogProps = {
  initialDegreesIn?: number;
  initialDegreesOut?: number;
  initialDiscourseContextDepth?: number;
};

type GraphExportDialogComponent = (
  props: RoamOverlayProps<GraphExportDialogProps>,
) => JSX.Element;

const GraphExportDialog: GraphExportDialogComponent = ({
  isOpen,
  onClose,
  initialDegreesIn = 0,
  initialDegreesOut = 0,
  initialDiscourseContextDepth,
}) => {
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("Exporting data");
  const [discourseProgress, setDiscourseProgress] = useState(0);
  const [discourseMessage, setDiscourseProgressMessage] =
    useState("Exporting data");
  const [loading, setLoading] = useState(false);

  const pages = useMemo(() => {
    return window.roamAlphaAPI.ui.graphView.wholeGraph.getExplorePages();
  }, []);

  const initialUids = useMemo(() => {
    return pages.map((x) => getPageUidByPageTitle(x)) || [];
  }, [pages]);

  const [currentTab, setCurrentTab] = useState("by-references");
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [degreesIn, setDegreesIn] = useState(initialDegreesIn);
  const [degreesOut, setDegreesOut] = useState(initialDegreesOut);
  const [discourseContextDepth, setDiscourseContextDepth] = useState(
    initialDiscourseContextDepth || Math.max(degreesIn, degreesOut),
  );

  const onTabOrDegreeChange = () => {
    updateProgressWithDelay({ progress: 0 });
    setShowResults(false);
    setResults([]);
  };

  const ByDiscourseContextPanel = (
    <>
      <Callout className="mb-5">
        Export Discourse Nodes and their Discourse Context based on relation
        depth from the initial nodes.
      </Callout>
      <Label>Depth</Label>
      <Slider
        min={0}
        max={5}
        stepSize={1}
        labelStepSize={1}
        onChange={(v) => {
          onTabOrDegreeChange();
          setDiscourseContextDepth(v);
        }}
        value={discourseContextDepth}
      />
    </>
  );

  const ByReferencesPanel = (
    <>
      <Callout className="mb-5">
        Export any Discourse Nodes and their Discourse Context that reference or
        are referenced by any page starting from the initial pages.
      </Callout>
      <Tooltip placement="top" content={"Pages that link to a selected page"}>
        <Label>Degrees In</Label>
      </Tooltip>
      <Slider
        min={0}
        max={5}
        stepSize={1}
        labelStepSize={1}
        onChange={(v) => {
          onTabOrDegreeChange();
          setDegreesIn(v);
        }}
        value={degreesIn}
      />
      <Tooltip placement="top" content={"Pages that link from a selected page"}>
        <Label>Degrees Out</Label>
      </Tooltip>
      <Slider
        min={0}
        max={5}
        stepSize={1}
        labelStepSize={1}
        onChange={(v) => {
          onTabOrDegreeChange();
          setDegreesOut(v);
        }}
        value={degreesOut}
      />
    </>
  );

  const ResultsProgress = ({
    progress,
    progressMessage,
  }: {
    progress: number;
    progressMessage: string;
  }) => {
    return (
      <>
        {progress ? (
          <Callout className="mt-2">
            <div className="mb-2">{progressMessage}</div>
            <ProgressBar
              value={progress}
              intent={progress === 1 ? Intent.SUCCESS : Intent.PRIMARY}
              animate={progress !== 1}
              className="mb-2"
            />
          </Callout>
        ) : null}
      </>
    );
  };
  const DiscourseContextDepthProgress = ({
    discourseProgress,
    discourseMessage,
  }: {
    discourseProgress: number;
    discourseMessage: string;
  }) => {
    return (
      <>
        {discourseProgress && discourseProgress !== 1 ? (
          <Callout className="mt-2">
            <div className="mb-2">{discourseMessage}</div>
            <ProgressBar
              value={discourseProgress}
              intent={Intent.PRIMARY}
              className="mb-2"
            />
          </Callout>
        ) : null}
      </>
    );
  };

  // Delay before and after seemed to the only way to consistently update the progress bar
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const updateProgressWithDelay: UpdateProgressWithDelay = async ({
    progress,
    delayAmount = 500,
    message,
    isDiscourse = false,
  }) => {
    await delay(delayAmount);
    if (isDiscourse) {
      setDiscourseProgress(progress);
      if (message) setDiscourseProgressMessage(message);
      return;
    } else {
      setProgress(progress);
      if (message) setProgressMessage(message);
    }
    await delay(delayAmount);
  };

  const getResults = async () => {
    if (currentTab === "by-references") {
      await updateProgressWithDelay({
        progress: 0.1,
        message: "Getting References",
      });
      const referenceUids = await getAllReferencesByDegree(
        initialUids,
        degreesIn,
        degreesOut,
      );

      await updateProgressWithDelay({
        progress: 0.5,
        message: "Filtering Discourse Nodes",
      });
      const discourseNodeUids = Array.from(referenceUids).filter((uid) =>
        isDiscourseNode(uid),
      );

      await updateProgressWithDelay({
        progress: 0.75,
        message: "Grabbing Page Titles",
      });
      const discourseNodeResults = discourseNodeUids.map((uid) => ({
        uid,
        text: getPageTitleByPageUid(uid),
      }));

      // Saved for when user requests to get discourse context from results
      //
      // await updateProgressWithDelay({
      //   progress: 0.5,
      //   message: "Getting discourse context...",
      // });
      // const allDiscourseContextResults = await getAllDiscourseContext(
      //   discourseNodeUids,
      //   Math.max(degreesIn, degreesOut),
      //   new Set<string>(),
      //   updateProgressWithDelay
      // );

      return discourseNodeResults;
    }
    if (currentTab === "by-discourse-relations") {
      return await getAllDiscourseContext(
        initialUids,
        discourseContextDepth,
        updateProgressWithDelay,
      );
    }
    return [];
  };

  const onPreview = async () => {
    setLoading(true);
    setTimeout(async () => {
      const results = await getResults();
      await updateProgressWithDelay({ progress: 1, message: "Done!" });
      setResults(results);
      setShowResults(true);
      setLoading(false);
    }, 0);
  };

  const onExport = async () => {
    exportRender({
      results,
      title: "Export Discourse Graph",
    });
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      title="Discourse Graph Context Export"
      onClose={onClose}
      autoFocus={false}
    >
      <div className={Classes.DIALOG_BODY}>
        <Tabs
          id="discourse-graph-export-tabs"
          selectedTabId={currentTab}
          onChange={(id) => {
            onTabOrDegreeChange();
            setCurrentTab(id as string);
          }}
          large={true}
        >
          <Tab
            id="by-references"
            title="By References"
            panel={ByReferencesPanel}
          />
          <Tab
            id="by-discourse-relations"
            title="By Discourse Relations"
            panel={ByDiscourseContextPanel}
          />
        </Tabs>
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            loading={loading}
            onClick={() => onPreview()}
            intent="warning"
          >
            Preview
          </Button>
          <Button
            intent="primary"
            onClick={() => onExport()}
            disabled={!results.length}
          >
            Export
          </Button>
        </div>
        <ResultsProgress
          progress={progress}
          progressMessage={progressMessage}
        />
        <DiscourseContextDepthProgress
          discourseProgress={discourseProgress}
          discourseMessage={discourseMessage}
        />

        <Collapse isOpen={showResults}>
          {results.length > 0 ? (
            <ul>
              {results.map((r) => {
                return <li>{r.text}</li>;
              })}
            </ul>
          ) : (
            "No results"
          )}
        </Collapse>
      </div>
    </Dialog>
  );
};

const GraphExportButton = () => {
  return (
    <Button
      className="w-full"
      icon="export"
      onClick={() => {
        const { degreesIn, degreesOut } = getGraphOverviewDepthValues();
        posthog.capture("Discourse graph: export button clicked", {
          degreesIn: degreesIn,
          degreesOut: degreesOut,
        });

        renderOverlay({
          id: "graph-export",
          Overlay: GraphExportDialog,
          props: {
            initialDegreesIn: degreesIn,
            initialDegreesOut: degreesOut,
          },
        });
      }}
    >
      Export
    </Button>
  );
};

export const render = (block: HTMLDivElement) => {
  const div = document.createElement("div");
  div.className = "roamjs-discourse-graph-export-button";
  ReactDOM.render(<GraphExportButton />, div);
  block.appendChild(div);
};
