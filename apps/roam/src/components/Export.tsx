import {
  Button,
  Checkbox,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Label,
  ProgressBar,
  Toaster,
  Toast,
  Tooltip,
  Tab,
  Tabs,
  RadioGroup,
  Radio,
  FormGroup,
} from "@blueprintjs/core";
import React, { useState, useEffect, useMemo, FormEvent } from "react";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { saveAs } from "file-saver";
import { Result } from "roamjs-components/types/query-builder";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import getExportTypes, { updateExportProgress } from "~/utils/getExportTypes";
import nanoid from "nanoid";
import apiPost from "roamjs-components/util/apiPost";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getExtensionAPI from "roamjs-components/util/extensionApiContext";
import getBlockProps from "~/utils/getBlockProps";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import findDiscourseNode from "../utils/findDiscourseNode";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "~/index";
import { Column } from "~/utils/types";
import { render as renderToast } from "roamjs-components/components/Toast";
import { getNodeEnv } from "roamjs-components/util/env";
import apiGet from "roamjs-components/util/apiGet";
import apiPut from "roamjs-components/util/apiPut";
import { ExportGithub } from "./ExportGithub";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import createPage from "roamjs-components/writes/createPage";
import {
  createShapeId,
  IndexKey,
  TLParentId,
  getIndexAbove,
  TLShape,
  defaultShapeUtils,
  defaultBindingUtils,
} from "tldraw";
import {
  createTLStore,
  SerializedStore,
  TLRecord,
  TLStoreSnapshot,
  loadSnapshot,
} from "@tldraw/editor";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import {
  createNodeShapeUtils,
  DiscourseNodeShape,
} from "~/components/canvas/DiscourseNodeUtil";
import { discourseContext, MAX_WIDTH } from "~/components/canvas/Tldraw";
import internalError from "~/utils/internalError";
import { getSetting, setSetting } from "~/utils/extensionSettings";
import { isTLStoreSnapshot } from "./canvas/useRoamStore";
import { createMigrations } from "./canvas/DiscourseRelationShape/discourseRelationMigrations";
import {
  createAllRelationBindings,
  createAllReferencedNodeBindings,
} from "./canvas/DiscourseRelationShape/DiscourseRelationBindings";
import {
  createAllRelationShapeUtils,
  createAllReferencedNodeUtils,
} from "./canvas/DiscourseRelationShape/DiscourseRelationUtil";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import { AddReferencedNodeType } from "./canvas/DiscourseRelationShape/DiscourseRelationTool";
import posthog from "posthog-js";

const ExportProgress = ({ id }: { id: string }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const listener = ((e: CustomEvent) => {
      if (e.detail.id === id) setProgress(e.detail.progress);
    }) as EventListener;
    document.body.addEventListener("roamjs:export:progress", listener);
    return () =>
      document.body.removeEventListener("roamjs:export:progress", listener);
  }, [setProgress, id]);
  return (
    <Toaster position="bottom-right" maxToasts={1}>
      {progress ? (
        <Toast
          timeout={0}
          onDismiss={() => setProgress(0)}
          intent={Intent.PRIMARY}
          icon={"download"}
          message={
            <>
              <div>Exporting data...</div>
              <ProgressBar value={progress} intent={Intent.SUCCESS} />
              <span>{(progress * 100).toFixed(2)}%</span>
            </>
          }
        />
      ) : null}
    </Toaster>
  );
};

export type ExportDialogProps = {
  results?: Result[];
  title?: string;
  columns?: Column[];
  isExportDiscourseGraph?: boolean;
  initialPanel?: "sendTo" | "export";
};

type ExportDialogComponent = (
  props: RoamOverlayProps<ExportDialogProps>,
) => JSX.Element;

const EXPORT_DESTINATIONS = [
  { id: "local", label: "Download Locally", active: true },
  { id: "app", label: "Store in Roam", active: false },
  { id: "github", label: "Send to GitHub", active: true },
];
const SEND_TO_DESTINATIONS = ["page", "graph"];

const exportDestinationById = Object.fromEntries(
  EXPORT_DESTINATIONS.map((ed) => [ed.id, ed]),
);

const ExportDialog: ExportDialogComponent = ({
  onClose,
  isOpen,
  results = [],
  columns,
  title = "Share Data",
  isExportDiscourseGraph = false,
  initialPanel,
}) => {
  const [selectedRepo, setSelectedRepo] = useState<string>(
    getSetting<string>("selected-repo", ""),
  );
  const exportId = useMemo(() => nanoid(), []);
  useEffect(() => {
    setDialogOpen(isOpen);
  }, [isOpen]);

  // TODO: maybe add posthog capture here for isOpen

  const [dialogOpen, setDialogOpen] = useState(isOpen);
  const exportTypes = useMemo(
    () => getExportTypes({ results, exportId, isExportDiscourseGraph }),
    [results, exportId],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const today = new Date();
  const [filename, setFilename] = useState(
    `${
      window.roamAlphaAPI.graph.name
    }_query-results_${`${today.getFullYear()}${(today.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}${today
      .getHours()
      .toString()
      .padStart(2, "0")}${today.getMinutes().toString().padStart(2, "0")}`}`,
  );
  const [activeExportType, setActiveExportType] = useState<string>(
    exportTypes[0].name,
  );
  const [activeExportDestination, setActiveExportDestination] =
    useState<string>(EXPORT_DESTINATIONS[0].id);

  const checkForCanvasPage = (title: string) => {
    const canvasPageFormat =
      (getExtensionAPI().settings.get("canvas-page-format") as string) ||
      DEFAULT_CANVAS_PAGE_FORMAT;
    return new RegExp(`^${canvasPageFormat}$`.replace(/\*/g, ".+")).test(title);
  };
  const firstColumnKey = columns?.[0]?.key || "text";
  const currentPageUid = getCurrentPageUid();
  const currentPageTitle = getPageTitleByPageUid(currentPageUid);
  const [selectedPageTitle, setSelectedPageTitle] = useState(currentPageTitle);
  const [selectedPageUid, setSelectedPageUid] = useState(currentPageUid);
  const isCanvasPage = checkForCanvasPage(selectedPageTitle);
  const [activeSendToDestination, setActiveSendToDestination] =
    useState<(typeof SEND_TO_DESTINATIONS)[number]>("page");
  const isSendToGraph = activeSendToDestination === "graph";
  const [livePages, setLivePages] = useState<Result[]>([]);
  const [selectedTabId, setSelectedTabId] = useState("sendto");
  useEffect(() => {
    if (initialPanel === "export") setSelectedTabId("export");
  }, [initialPanel]);
  const [includeDiscourseContext, setIncludeDiscourseContext] = useState(false);
  const [gitHubAccessToken, setGitHubAccessToken] = useState<string | null>(
    getSetting<string | null>("oauth-github", null),
  );

  const [canSendToGitHub, setCanSendToGitHub] = useState(false);

  const writeFileToRepo = async ({
    filename,
    content,
    setError,
  }: {
    filename: string;
    content: string;
    setError: (error: string) => void;
  }): Promise<{ status: number }> => {
    const base64Content = btoa(content);

    try {
      const response = await apiPut({
        domain: "https://api.github.com",
        path: `repos/${selectedRepo}/contents/${filename}`,
        headers: { Authorization: `token ${gitHubAccessToken}` },
        data: { message: `Add ${filename}`, content: base64Content },
      });
      if (response.status === 401) {
        setGitHubAccessToken(null);
        setError("Authentication failed. Please log in again.");
        await setSetting("oauth-github", "");
        return { status: 401 };
      }
      return { status: response.status };
    } catch (error) {
      const e = error as Error;
      if (e.message.includes('"sha" wasn\'t supplied.')) {
        setError("File already exists");
        return { status: 500 };
      }
      setError("Failed to upload file to repo");
      return { status: 500 };
    }
  };

  const handleSetSelectedPage = (title: string) => {
    setSelectedPageTitle(title);
    setSelectedPageUid(getPageUidByPageTitle(title));
  };

  /* eslint-disable @typescript-eslint/naming-convention */
  const addToSelectedCanvas = async (pageUid: string) => {
    if (typeof results !== "object") return false;

    const blockProps: Record<string, unknown> = getBlockProps(pageUid);

    const PADDING_BETWEEN_SHAPES = 20;
    const COMMON_BOUNDS_XOFFSET = 250;
    const MAX_COLUMNS = 5;
    const COLUMN_WIDTH = Number(MAX_WIDTH.replace("px", ""));
    const rjsqb = blockProps["roamjs-query-builder"] as Record<string, unknown>;
    const tldrawRaw = rjsqb?.["tldraw"];
    const isTLStore = isTLStoreSnapshot(tldrawRaw);
    // tldraw is either TLStoreSnapshot or a mutable Record (empty object when new)
    const tldraw: TLStoreSnapshot | Record<string, unknown> = isTLStore
      ? tldrawRaw
      : (tldrawRaw as Record<string, unknown>) || {};

    const isLegacyStore =
      !isTLStore &&
      tldraw !== null &&
      tldraw !== undefined &&
      typeof tldraw === "object" &&
      Object.keys(tldraw).length !== 0;
    if (isLegacyStore) {
      const toastContent = (
        <>
          Canvas page{" "}
          <a
            onClick={(event) => {
              if (event.shiftKey) {
                void window.roamAlphaAPI.ui.rightSidebar.addWindow({
                  // @ts-expect-error - todo test
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  window: { "block-uid": pageUid, type: "outline" },
                });
              } else {
                void window.roamAlphaAPI.ui.mainWindow.openPage({
                  page: { uid: pageUid },
                });
              }
            }}
          >
            [[{selectedPageTitle}]]
          </a>{" "}
          is using a legacy store format. Please upgrade to the latest version
          of the extension to continue.
        </>
      );
      renderToast({
        content: toastContent,
        id: "legacy-store-format-not-supported",
      });
      return false;
    }

    let tempTlStoreSnapshot: TLStoreSnapshot | undefined;

    // New Canvas Page, creating new TLStore
    // TODO lots of this is reused in tldraw.tsx, use a function to avoid duplication
    if (!isTLStore) {
      const relations = getDiscourseRelations();
      discourseContext.relations = relations.reduce(
        (acc, r) => {
          if (acc[r.label]) {
            acc[r.label].push(r);
          } else {
            acc[r.label] = [r];
          }
          return acc;
        },
        {} as Record<string, DiscourseRelation[]>,
      );
      const allRelations = relations;
      const allRelationIds = allRelations.map((r) => r.id);
      const allNodes = getDiscourseNodes(allRelations);
      const allAddReferencedNodeByAction = (() => {
        const obj: AddReferencedNodeType = {};

        // TODO: support multiple referenced node
        // with migration from format to specification
        allNodes.forEach((n) => {
          const referencedNodes = [
            ...n.format.matchAll(/{([\w\d-]+)}/g),
          ].filter((match) => match[1] !== "content");

          if (referencedNodes.length > 0) {
            const sourceName = referencedNodes[0][1];
            const sourceType = allNodes.find((node) => node.text === sourceName)
              ?.type as string;

            if (!obj[`Add ${sourceName}`]) obj[`Add ${sourceName}`] = [];

            obj[`Add ${sourceName}`].push({
              format: n.format,
              sourceName,
              sourceType,
              destinationType: n.type,
              destinationName: n.text,
            });
          }
        });

        return obj;
      })();
      const allAddReferencedNodeActions = Object.keys(
        allAddReferencedNodeByAction,
      );

      // UTILS
      const discourseNodeUtils = createNodeShapeUtils(allNodes);
      const discourseRelationUtils =
        createAllRelationShapeUtils(allRelationIds);
      const referencedNodeUtils = createAllReferencedNodeUtils(
        allAddReferencedNodeByAction,
      );
      const customShapeUtils = [
        ...discourseNodeUtils,
        ...discourseRelationUtils,
        ...referencedNodeUtils,
      ];
      // BINDINGS
      const relationBindings = createAllRelationBindings(allRelationIds);
      const referencedNodeBindings = createAllReferencedNodeBindings(
        allAddReferencedNodeByAction,
      );
      const customBindingUtils = [
        ...relationBindings,
        ...referencedNodeBindings,
      ];
      const discourseMigrations = createMigrations({
        allRelationIds,
        allAddReferencedNodeActions,
        allNodeTypes: allNodes.map((node) => node.type),
      });
      const migrations = [discourseMigrations];

      const tlStore = createTLStore({
        migrations,
        shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
        bindingUtils: [...defaultBindingUtils, ...customBindingUtils],
      });

      // Initialize store with default document and page records
      const defaultStore = {
        "document:document": {
          gridSize: 10,
          name: "",
          meta: {},
          id: "document:document",
          typeName: "document",
        } as TLRecord,
        "page:page": {
          meta: {},
          id: "page:page",
          name: "Page 1",
          index: "a1",
          typeName: "page",
        } as TLRecord,
      } as SerializedStore<TLRecord>;

      const defaultSnapshot: TLStoreSnapshot = {
        store: defaultStore,
        schema: tlStore.schema.serialize(),
      };

      loadSnapshot(tlStore, defaultSnapshot);
      tldraw.schema = tlStore.schema.serialize();
      tempTlStoreSnapshot = tlStore.getStoreSnapshot();
    }
    /* eslint-disable @typescript-eslint/naming-convention */

    const tlStoreSnapshot = isTLStore
      ? (tldraw as TLStoreSnapshot) // isTlStore type checked above
      : tempTlStoreSnapshot;

    if (!tlStoreSnapshot) {
      internalError({
        error: new Error("no tlStoreSnapshot"),
        type: "Failed to add to selected canvas",
        userMessage:
          "Failed to add to selected canvas. The team has been notified.",
        context: {
          pageUid,
          results,
          blockProps,
        },
      });
      return false;
    }
    const getPageKey = (
      obj: SerializedStore<TLRecord>,
    ): TLParentId | undefined => {
      for (const [key, value] of Object.entries(obj)) {
        if (
          value &&
          typeof value === "object" &&
          "typeName" in value &&
          value.typeName === "page"
        ) {
          return key as TLParentId;
        }
      }
      return undefined;
    };
    const pageKey = getPageKey(tlStoreSnapshot.store);
    if (!pageKey) {
      internalError({
        error: new Error("no page key"),
        type: "Failed to add to selected canvas",
        userMessage:
          "Failed to add to selected canvas. The team has been notified.",
        context: {
          pageUid,
          results,
          blockProps,
        },
      });
      return false;
    }

    type TLdrawProps = { [key: string]: any };
    type ShapeBounds = { x: number; y: number; w: number; h: number };
    const extractShapesBounds = (store: TLdrawProps): ShapeBounds[] => {
      if (!store) return [];
      return Object.keys(store)
        .filter((key) => store[key].typeName === "shape")
        .map((key) => {
          const shape = store[key];
          return { x: shape.x, y: shape.y, w: shape.props.w, h: shape.props.h };
        });
    };
    const shapeBounds = extractShapesBounds(tlStoreSnapshot.store);

    // Get existing shapes to determine the highest index
    const existingShapes = Object.values(tlStoreSnapshot.store).filter(
      (shape) => (shape as TLShape).typeName === "shape",
    );

    // Find the highest index among existing shapes
    let currentIndex: IndexKey = "a1" as IndexKey;
    if (existingShapes.length > 0) {
      const highestIndex = existingShapes.reduce((highest: IndexKey, shape) => {
        const shapeWithIndex = shape as TLShape;
        return shapeWithIndex.index.localeCompare(highest) > 0
          ? shapeWithIndex.index
          : highest;
      }, "a1" as IndexKey);
      currentIndex = highestIndex;
    }

    type CommonBounds = {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    const findCommonBounds = (shapes: ShapeBounds[]): CommonBounds => {
      if (!shapes.length) return { top: 0, right: 0, bottom: 0, left: 0 };

      let maxX = Number.MIN_SAFE_INTEGER;
      let maxY = Number.MIN_SAFE_INTEGER;
      let minX = Number.MAX_SAFE_INTEGER;
      let minY = Number.MAX_SAFE_INTEGER;

      shapes.forEach((shape) => {
        const rightX = shape.x + shape.w;
        const leftX = shape.x;
        const topY = shape.y;
        const bottomY = shape.y - shape.h;

        if (rightX > maxX) maxX = rightX;
        if (leftX < minX) minX = leftX;
        if (topY < minY) minY = topY;
        if (bottomY > maxY) maxY = bottomY;
      });

      return { top: minY, right: maxX, bottom: maxY, left: minX };
    };
    const commonBounds = findCommonBounds(shapeBounds);

    let currentRowHeight = 0;
    let nextShapeX = COMMON_BOUNDS_XOFFSET;
    let shapeY = commonBounds.top;
    for (const [i, r] of results.entries()) {
      const discourseNode = findDiscourseNode({ uid: r.uid });
      const nodeType = discourseNode ? discourseNode.type : "page-node";
      const extensionAPI = getExtensionAPI();
      const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
        nodeText: String(r[firstColumnKey]),
        uid: r.uid,
        nodeType,
        extensionAPI,
      });
      const newShapeId = createShapeId();
      currentIndex = getIndexAbove(currentIndex);

      const newShape: DiscourseNodeShape = {
        index: currentIndex,
        rotation: 0,
        isLocked: false,
        type: nodeType,
        props: {
          w,
          h,
          uid: r.uid,
          title: String(r[firstColumnKey]),
          imageUrl,
          size: "s",
          fontFamily: "sans",
        },
        parentId: pageKey,
        y: shapeY,
        id: newShapeId,
        typeName: "shape",
        x: commonBounds.right + nextShapeX,
        meta: {},
        opacity: 1,
      };

      nextShapeX += COLUMN_WIDTH + PADDING_BETWEEN_SHAPES;
      if (h > currentRowHeight) currentRowHeight = h;
      if ((i + 1) % MAX_COLUMNS === 0) {
        shapeY += currentRowHeight + PADDING_BETWEEN_SHAPES;
        currentRowHeight = 0;
        nextShapeX = COMMON_BOUNDS_XOFFSET;
      }

      tlStoreSnapshot.store[newShapeId] = newShape;
    }

    const newStateId = nanoid();
    try {
      await window.roamAlphaAPI.updateBlock({
        block: {
          uid: pageUid,
          props: {
            ...blockProps,
            ["roamjs-query-builder"]: {
              ...rjsqb,
              tldraw: {
                ...(isTLStore ? tldraw : {}),
                store: tlStoreSnapshot.store,
                schema: tlStoreSnapshot.schema,
              },
              stateId: newStateId,
            },
          },
        },
      });
      return true;
    } catch (error) {
      internalError({
        error: error as Error,
        type: "Failed to add to selected canvas",
        userMessage:
          "Failed to add to selected canvas. The team has been notified.",
        context: {
          pageUid,
          results,
          blockProps,
        },
      });
      return false;
    }
  };

  const addToSelectedPage = (pageUid: string) => {
    if (typeof results === "object") {
      results.map((r) => {
        const isPage = !!getPageTitleByPageUid(r.uid);
        window.roamAlphaAPI.data.block.create({
          location: { "parent-uid": pageUid, order: "last" },
          block: {
            string: isPage ? `[[${r[firstColumnKey]}]]` : `((${r.uid}))`,
          },
        });
      });
    }
  };

  useEffect(() => {
    if (isSendToGraph) {
      if (typeof results === "object") {
        const livePages = results.filter((r) => !!getPageTitleByPageUid(r.uid));
        setLivePages(livePages);
      }
    }
  }, [isSendToGraph, results]);
  const addToGraphOverView = () => {
    if (typeof results === "object") {
      window.roamAlphaAPI.ui.graphView.wholeGraph.setMode("Explore");
      window.roamAlphaAPI.ui.graphView.wholeGraph.setExplorePages(
        livePages.map((r) => String(r[firstColumnKey])),
      );
      window.location.href = `${getRoamUrl()}/graph`;
    }
  };

  const handleSendTo = async () => {
    try {
      setLoading(true);
      let toastContent: React.ReactNode;
      let uid = selectedPageUid;
      const title = selectedPageTitle;
      const isCanvasDestination = !isSendToGraph && isCanvasPage;
      const shouldCreatePage = !isSendToGraph && !isLiveBlock(uid);

      if (isSendToGraph) {
        addToGraphOverView();
        toastContent = "Results sent!";
      } else {
        const isNewPage = !isLiveBlock(uid);
        if (isNewPage) uid = await createPage({ title });
        if (isCanvasPage) {
          const success = await addToSelectedCanvas(uid);
          if (!success) return;
        } else addToSelectedPage(uid);

        toastContent = (
          <>
            Results sent to{" "}
            <a
              onClick={(event) => {
                if (event.shiftKey) {
                  void window.roamAlphaAPI.ui.rightSidebar.addWindow({
                    // @ts-expect-error - todo test
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    window: { "block-uid": uid, type: "outline" },
                  });
                } else {
                  void window.roamAlphaAPI.ui.mainWindow.openPage({
                    page: { uid: uid },
                  });
                }
              }}
            >
              [[{title}]]
            </a>
          </>
        );
      }

      posthog.capture("Results View: Send To Destination", {
        destination: isSendToGraph ? "graph" : "page",
        isCanvasDestination,
        createdPage: shouldCreatePage,
        resultCount: results.length,
      });

      renderToast({
        content: toastContent,
        intent: "success",
        id: "query-builder-export-success",
      });
    } catch (e) {
      internalError({
        error: e as Error,
        type: "Export Dialog Failed",
        userMessage:
          "Looks like there was an error. The team has been notified.",
      });
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const handlePdfExport = async (
    files: { title: string; content: string }[],
    filename: string,
  ) => {
    const preparedFiles = files.map((f) => ({
      title: JSON.stringify(f.title),
      content: JSON.stringify(f.content),
    }));
    const domain =
      getNodeEnv() === "development"
        ? "http://localhost:3003"
        : "https://api.samepage.network";

    try {
      const response = await apiPost({
        domain,
        path: "pdf",
        data: { files: preparedFiles, filename },
      });
      const responseData = JSON.parse(response.data);
      const path = JSON.parse(responseData.body);
      const download = await apiGet<ArrayBuffer>({
        domain: "https://samepage.network",
        path,
        buffer: true,
      });

      if (download) {
        const blob = new Blob([download], { type: "application/zip" });
        saveAs(blob, `${filename}.zip`);
        posthog.capture("Export Dialog: Export Completed", {
          exportType: "PDF",
          destination: activeExportDestination,
          fileCount: files.length,
        });
      }
      onClose();
    } catch (e) {
      setError("Failed to export files.");
      posthog.capture("Export Dialog: Export Failed", {
        exportType: "PDF",
        destination: activeExportDestination,
        error: (e as Error).message ?? "unknown error",
      });
    }
  };
  const ExportPanel = (
    <>
      <div className={Classes.DIALOG_BODY}>
        <div className="flex items-start justify-between gap-16">
          <Label className="flex-grow">
            Export Type
            <MenuItemSelect
              items={exportTypes.map((e) => e.name)}
              activeItem={activeExportType}
              onItemSelect={(et) => setActiveExportType(et)}
            />
          </Label>
          <div>
            <Label className="flex-grow">
              Destination
              <MenuItemSelect
                items={
                  results.length === 1 && activeExportType === "Markdown" // TODO handle more github exports
                    ? EXPORT_DESTINATIONS.map((ed) => ed.id)
                    : EXPORT_DESTINATIONS.map((ed) => ed.id).filter(
                        (ed) => ed !== "github",
                      )
                }
                transformItem={(s) => exportDestinationById[s].label}
                activeItem={activeExportDestination}
                onItemSelect={(et) => setActiveExportDestination(et)}
              />
            </Label>
            <ExportGithub
              isVisible={activeExportDestination === "github"}
              selectedRepo={selectedRepo}
              setSelectedRepo={setSelectedRepo}
              setError={setError}
              gitHubAccessToken={gitHubAccessToken}
              setGitHubAccessToken={setGitHubAccessToken}
              setCanSendToGitHub={setCanSendToGitHub}
            />
          </div>
        </div>

        <Label>
          Filename
          <InputGroup
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            disabled={results.length === 1} // TODO handle single result filename based on export type or user input
          />
        </Label>

        <div className="flex items-end justify-between">
          <span>
            {typeof results === "function"
              ? "Calculating number of results..."
              : `Exporting ${results.length} results`}
          </span>
          <div className="flex flex-col items-end">
            <FormGroup className={`m-0`} inline>
              <Checkbox
                alignIndicator={"right"}
                checked={includeDiscourseContext}
                onChange={(e) => {
                  setIncludeDiscourseContext(
                    (e.target as HTMLInputElement).checked,
                  );
                }}
                labelElement={
                  <Tooltip
                    className="m-0"
                    content={
                      "Include the discourse context of each result in the export."
                    }
                  >
                    <span>Discourse context</span>
                  </Tooltip>
                }
              />
            </FormGroup>
          </div>
        </div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <span style={{ color: "darkred" }}>{error}</span>
          <Button text={"Cancel"} intent={Intent.NONE} onClick={onClose} />
          <Button
            text={"Export"}
            intent={Intent.PRIMARY}
            onClick={() => {
              if (!exportDestinationById[activeExportDestination].active) {
                setError(
                  `Export destination ${exportDestinationById[activeExportDestination].label} is not yet supported.`,
                );
                return;
              }
              setLoading(true);
              updateExportProgress({ progress: 0, id: exportId });
              setError("");
              posthog.capture("Export Dialog: Export Started", {
                exportType: activeExportType,
                destination: activeExportDestination,
                includeDiscourseContext,
                resultCount: results.length,
                isExportDiscourseGraph,
              });
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              setTimeout(async () => {
                try {
                  const exportType = exportTypes.find(
                    (e) => e.name === activeExportType,
                  );
                  if (exportType && window.RoamLazy) {
                    setDialogOpen(true);
                    setLoading(false);
                    updateExportProgress({ progress: 0.0001, id: exportId });
                    const files = await exportType.callback({
                      filename,
                      includeDiscourseContext,
                      isExportDiscourseGraph,
                    });
                    if (!files.length) {
                      setDialogOpen(true);
                      setError("Failed to find any results to export.");
                      return;
                    }

                    if (activeExportType === "PDF") {
                      void handlePdfExport(files, filename);
                      return;
                    }

                    if (activeExportDestination === "github") {
                      const { title, content } = files[0];
                      try {
                        const { status } = await writeFileToRepo({
                          filename: title,
                          content,
                          setError,
                        });
                        if (status === 201) {
                          // TODO: remove toast by prolonging ExportProgress
                          renderToast({
                            id: "export-success",
                            content: "Upload Success",
                            intent: "success",
                          });
                          posthog.capture("Export Dialog: Export Completed", {
                            exportType: activeExportType,
                            destination: activeExportDestination,
                            fileCount: files.length,
                          });
                          onClose();
                        }
                      } catch (error) {
                        const e = error as Error;
                        setError(e.message);
                      }
                      return;
                    }

                    if (files.length === 1) {
                      const { title, content } = files[0];
                      const blob = new Blob([content], {
                        type: "text/plain;charset=utf-8",
                      });
                      saveAs(blob, title);
                      posthog.capture("Export Dialog: Export Completed", {
                        exportType: activeExportType,
                        destination: activeExportDestination,
                        fileCount: files.length,
                      });
                      onClose();
                      return;
                    }

                    const zip = await window.RoamLazy.JSZip().then(
                      (j) => new j(),
                    );
                    files.forEach(({ title, content }) =>
                      zip.file(title, content),
                    );
                    void zip.generateAsync({ type: "blob" }).then((content) => {
                      saveAs(content, `${filename}.zip`);
                      posthog.capture("Export Dialog: Export Completed", {
                        exportType: activeExportType,
                        destination: activeExportDestination,
                        fileCount: files.length,
                      });
                      onClose();
                    });
                  } else {
                    setError(`Unsupported export type: ${exportType}`);
                  }
                } catch (e) {
                  posthog.capture("Export Dialog: Export Failed", {
                    exportType: activeExportType,
                    destination: activeExportDestination,
                    error: (e as Error).message ?? "unknown error",
                  });
                  internalError({
                    error: e as Error,
                    type: "Export Dialog Failed",
                    userMessage:
                      "Looks like there was an error. The team has been notified.",
                    context: {
                      activeExportType,
                      filename,
                      resultsCount: Array.isArray(results)
                        ? results.length
                        : undefined,
                      sampleUids: Array.isArray(results)
                        ? results.slice(0, 10).map((r) => r.uid)
                        : undefined,
                    },
                  });
                  setDialogOpen(true);
                  setError((e as Error).message);
                } finally {
                  updateExportProgress({ progress: 0, id: exportId });
                }
              }, 1);
            }}
            style={{ minWidth: 64 }}
            disabled={
              loading ||
              (activeExportDestination === "github" && !canSendToGitHub)
            }
          />
        </div>
      </div>
    </>
  );

  const SendToPanel = (
    <>
      <div className={Classes.DIALOG_BODY}>
        <RadioGroup
          onChange={(e: FormEvent<HTMLInputElement>) => {
            const target = e.target as HTMLInputElement;
            setActiveSendToDestination(target.value);
          }}
          selectedValue={activeSendToDestination}
        >
          <Radio value="graph" label="Visualize in Graph Overview" />
          <Radio value="page" label="Send to Page" />
        </RadioGroup>
        {!isSendToGraph && (
          <div className="mb-2.5">
            <AutocompleteInput
              value={selectedPageTitle}
              setValue={(title) => handleSetSelectedPage(title)}
              onBlur={(title) => handleSetSelectedPage(title)}
              options={getAllPageNames()}
            />
          </div>
        )}
        {isSendToGraph && !livePages.length ? (
          <div className="my-2.5">No Pages found in Results</div>
        ) : null}
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button text={"Cancel"} intent={Intent.NONE} onClick={onClose} />
          <Button
            text={`Send ${
              isSendToGraph ? livePages.length : results.length
            } results`}
            intent={Intent.PRIMARY}
            onClick={handleSendTo}
            style={{ minWidth: 64 }}
            disabled={isSendToGraph ? !livePages.length : false}
            loading={loading}
          />
        </div>
      </div>
    </>
  );

  return (
    <>
      <Dialog
        isOpen={dialogOpen}
        canEscapeKeyClose={false}
        canOutsideClickClose={false}
        isCloseButtonShown={false}
        title={title}
        autoFocus={false}
        enforceFocus={false}
        portalClassName={"roamjs-export-dialog-body"}
      >
        <Tabs
          id="export-tabs"
          large={true}
          selectedTabId={selectedTabId}
          onChange={(newTabId: string) => {
            setSelectedTabId(newTabId);
            posthog.capture("Export Dialog: Tab Opened", {
              tabId: newTabId,
            });
          }}
        >
          <Tab id="sendto" title="Send To" panel={SendToPanel} />
          <Tab id="export" title="Export" panel={ExportPanel} />
        </Tabs>
      </Dialog>
      <ExportProgress id={exportId} />
    </>
  );
};

export const render = (props: ExportDialogProps) =>
  renderOverlay({ Overlay: ExportDialog, props });

export default ExportDialog;
