import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Callout,
  Classes,
  Collapse,
  Dialog,
  Icon,
  Intent,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
} from "@blueprintjs/core";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import {
  TldrawUiMenuItem,
  useActions,
  useEditor,
  TLShapeId,
  useValue,
  useQuickReactor,
  Vec,
  Box,
  createShapeId,
  TLDefaultSizeStyle,
  TLDefaultFontStyle,
  FONT_FAMILIES,
} from "tldraw";
import { useAtom } from "@tldraw/state";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import { Result } from "roamjs-components/types/query-builder";
import fuzzy from "fuzzy";
import { getAllReferencesOnPage } from "~/utils/hyde";
import isDiscourseNode from "~/utils/isDiscourseNode";
import {
  DiscourseNodeShape,
  DEFAULT_STYLE_PROPS,
  FONT_SIZES,
} from "./DiscourseNodeUtil";
import { openBlockInSidebar, createBlock } from "roamjs-components/writes";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import findDiscourseNode from "~/utils/findDiscourseNode";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";
import { getDiscourseNodeColors } from "~/utils/getDiscourseNodeColors";
import { MAX_WIDTH } from "./Tldraw";
import getBlockProps from "~/utils/getBlockProps";
import setBlockProps from "~/utils/setBlockProps";
import { measureCanvasNodeText } from "~/utils/measureCanvasNodeText";
import internalError from "~/utils/internalError";

export type ClipboardPage = {
  uid: string;
  text: string;
};

type ClipboardContextValue = {
  isOpen: boolean;
  pages: ClipboardPage[];
  openClipboard: () => void;
  closeClipboard: () => void;
  toggleClipboard: () => void;
  addPage: (page: ClipboardPage) => void;
  removePage: (uid: string) => void;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const ClipboardContext = createContext<ClipboardContextValue | null>(null);

const CLIPBOARD_PROP_KEY = "pages";

const getOrCreateClipboardBlock = async (
  canvasPageTitle: string,
  userUid: string,
): Promise<string> => {
  const canvasPageUid = getPageUidByPageTitle(canvasPageTitle);
  if (!canvasPageUid) {
    throw new Error(`Canvas page not found: ${canvasPageTitle}`);
  }

  const clipboardBlockText = `${userUid}-clipboard`;

  const childBlocksData = window.roamAlphaAPI.pull(
    "[:block/children {:block/children [:block/uid :block/string]}]",
    [":node/title", canvasPageTitle],
  );
  const childBlocks =
    childBlocksData?.[":block/children"] &&
    Array.isArray(childBlocksData[":block/children"])
      ? (childBlocksData[":block/children"] as Array<{
          // eslint-disable-next-line @typescript-eslint/naming-convention
          ":block/uid": string;
          // eslint-disable-next-line @typescript-eslint/naming-convention
          ":block/string": string;
        }>)
      : [];

  const existingBlocks = childBlocks
    .filter((block) => block[":block/string"] === clipboardBlockText)
    .map((block) => [block[":block/uid"], block[":block/string"]]);

  if (existingBlocks && existingBlocks.length > 0 && existingBlocks[0]) {
    return existingBlocks[0][0];
  }

  // Create the block if it doesn't exist
  const newBlockUid = await createBlock({
    parentUid: canvasPageUid,
    node: { text: clipboardBlockText },
  });
  return newBlockUid;
};

export const ClipboardProvider = ({
  children,
  canvasPageTitle,
}: {
  children: React.ReactNode;
  canvasPageTitle: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pages, setPages] = useState<ClipboardPage[]>([]);
  const [clipboardBlockUid, setClipboardBlockUid] = useState<string | null>(
    null,
  );
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeClipboard = async () => {
      try {
        const userUid = getCurrentUserUid();
        if (!userUid) {
          internalError({
            error: new Error("Missing current user UID"),
            type: "Canvas Clipboard: Missing current user UID",
            context: {
              canvasPageTitle,
            },
          });
          setIsInitialized(true);
          return;
        }

        const blockUid = await getOrCreateClipboardBlock(
          canvasPageTitle,
          userUid,
        );
        setClipboardBlockUid(blockUid);

        const props = getBlockProps(blockUid);
        const storedPages = props[CLIPBOARD_PROP_KEY];
        if (
          storedPages &&
          Array.isArray(storedPages) &&
          storedPages.length > 0
        ) {
          setPages(storedPages as ClipboardPage[]);
        }
      } catch (error) {
        internalError({
          error,
          type: "Canvas Clipboard: Failed to initialize",
          context: { canvasPageTitle },
        });
      } finally {
        setIsInitialized(true);
      }
    };

    void initializeClipboard();
  }, [canvasPageTitle]);

  useEffect(() => {
    if (!isInitialized || !clipboardBlockUid) return;

    try {
      setBlockProps(clipboardBlockUid, {
        [CLIPBOARD_PROP_KEY]: pages,
      });
    } catch (error) {
      internalError({
        error,
        type: "Canvas Clipboard: Failed to persist state",
        context: { clipboardBlockUid, pageCount: pages.length },
      });
    }
  }, [pages, clipboardBlockUid, isInitialized]);

  const openClipboard = useCallback(() => setIsOpen(true), []);
  const closeClipboard = useCallback(() => setIsOpen(false), []);
  const toggleClipboard = useCallback(() => setIsOpen((prev) => !prev), []);

  const addPage = useCallback((page: ClipboardPage) => {
    setPages((prev) => {
      if (prev.some((p) => p.uid === page.uid)) return prev;
      return [...prev, page];
    });
    setIsOpen(true);
  }, []);

  const removePage = useCallback((uid: string) => {
    setPages((prev) => prev.filter((p) => p.uid !== uid));
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      pages,
      openClipboard,
      closeClipboard,
      toggleClipboard,
      addPage,
      removePage,
    }),
    [
      isOpen,
      pages,
      addPage,
      closeClipboard,
      openClipboard,
      removePage,
      toggleClipboard,
    ],
  );

  return (
    <ClipboardContext.Provider value={value}>
      {children}
    </ClipboardContext.Provider>
  );
};

export const useClipboard = () => {
  const ctx = useContext(ClipboardContext);
  if (!ctx) throw new Error("ClipboardContext missing provider");
  return ctx;
};

type AddPageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (page: ClipboardPage) => void;
};

const AddPageModal = ({ isOpen, onClose, onConfirm }: AddPageModalProps) => {
  const [pageInput, setPageInput] = useState<Result>({ text: "", uid: "" });
  const [allResults, setAllResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setPageInput({ text: "", uid: "" });
    setError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const fetchAllPages = async () => {
      setIsLoading(true);
      try {
        const raw = await window.roamAlphaAPI.data.backend.q(
          `
            [:find ?text ?uid
            :where
            [?e :node/title ?text]
            [?e :block/uid ?uid]]`,
        );
        const results = raw.map(([text, uid]) => ({ text, uid })) as Result[];
        setAllResults(results);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };
    void fetchAllPages();
  }, [setError, setIsLoading]);

  const handleSubmit = useCallback(() => {
    onConfirm(pageInput);
    handleClose();
  }, [handleClose, onConfirm, pageInput]);

  const itemToQuery = useCallback((result?: Result) => result?.text || "", []);
  const filterOptions = useCallback(
    (o: Result[], q: string) =>
      fuzzy
        .filter(q, o, { extract: itemToQuery })
        .map((f) => f.original)
        .filter((f): f is Result => !!f),
    [itemToQuery],
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      className={"roamjs-canvas-dialog"}
    >
      <div
        // Prevents TLDraw from hijacking onClick and onMouseup
        // https://discord.com/channels/859816885297741824/1209834682384912397
        onPointerDown={(e) => e.stopPropagation()}
        style={{ pointerEvents: "all" }}
      >
        <div className={Classes.DIALOG_BODY}>
          <Callout
            intent="primary"
            className="mb-4"
            title="Add page to clipboard"
          />

          <AutocompleteInput
            value={pageInput}
            placeholder="Search for page"
            setValue={setPageInput}
            filterOptions={filterOptions}
            itemToQuery={itemToQuery}
            options={allResults}
            maxItemsDisplayed={50}
            multiline={true}
            autoFocus
          />
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div
            className={`${Classes.DIALOG_FOOTER_ACTIONS} flex-row-reverse items-center`}
          >
            <Button
              text={"Confirm"}
              intent={Intent.PRIMARY}
              onClick={handleSubmit}
              onTouchEnd={handleSubmit}
              disabled={isLoading || !pageInput.uid}
              className="flex-shrink-0"
            />
            <Button
              text={"Cancel"}
              onClick={onClose}
              onTouchEnd={onClose}
              disabled={isLoading}
              className="flex-shrink-0"
            />
            <span className={"flex-grow text-red-800"}>{error}</span>
            {isLoading && <Spinner size={SpinnerSize.SMALL} />}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

type NodeGroup = {
  uid: string;
  text: string;
  shapes: DiscourseNodeShape[];
  isDuplicate: boolean;
};

type DragState =
  | {
      name: "idle";
    }
  | {
      name: "pointing_item";
      node: {
        uid: string;
        text: string;
        backgroundColor: string;
        textColor: string;
      };
      startPosition: Vec;
    }
  | {
      name: "dragging";
      node: {
        uid: string;
        text: string;
        backgroundColor: string;
        textColor: string;
      };
      currentPosition: Vec;
    };

const ClipboardPageSection = ({
  page,
  onRemove,
}: {
  page: ClipboardPage;
  onRemove: (uid: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [discourseNodes, setDiscourseNodes] = useState<
    Array<{ uid: string; text: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [storeVersion, setStoreVersion] = useState(0);
  const editor = useEditor();
  const extensionAPI = useExtensionAPI();
  const rClipboardContainer = useRef<HTMLDivElement>(null);
  const rDraggingImage = useRef<HTMLDivElement>(null);
  const rHasDragged = useRef<boolean>(false);

  // Drag state management
  const dragState = useAtom<DragState>(
    `clipboardDragState-${page.uid}`,
    () => ({
      name: "idle",
    }),
  );

  useEffect(() => {
    const fetchDiscourseNodes = async () => {
      setIsLoading(true);
      try {
        const referencedPages = await getAllReferencesOnPage(page.text);
        const nodes = referencedPages.filter((refPage) =>
          isDiscourseNode(refPage.uid),
        );
        setDiscourseNodes(nodes);
      } catch (error) {
        internalError({
          error,
          type: "Canvas Clipboard: Failed to fetch discourse nodes",
          context: { pageTitle: page.text },
        });
        setDiscourseNodes([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      void fetchDiscourseNodes();
    }
  }, [page.text, isOpen]);

  // Listen to store changes to update clipboard when shapes are added/removed
  useEffect(() => {
    const unsubscribe = editor.store.listen((record) => {
      // Only update if shapes were added, removed, or updated
      const addedIds = Object.keys(record.changes.added);
      const removedIds = Object.keys(record.changes.removed);
      const updatedIds = Object.keys(record.changes.updated);

      const hasShapeChanges =
        addedIds.some(
          (id) =>
            record.changes.added[id as keyof typeof record.changes.added]
              ?.typeName === "shape",
        ) ||
        removedIds.some(
          (id) =>
            record.changes.removed[id as keyof typeof record.changes.removed]
              ?.typeName === "shape",
        ) ||
        updatedIds.some((id) => {
          const update =
            record.changes.updated[id as keyof typeof record.changes.updated];
          if (!update || !Array.isArray(update)) return false;
          const before = update[0];
          const after = update[1];
          return before?.typeName === "shape" || after?.typeName === "shape";
        });

      if (hasShapeChanges) {
        setStoreVersion((prev) => prev + 1);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [editor.store]);

  const findShapesByUid = useCallback(
    (uid: string): DiscourseNodeShape[] => {
      const allRecords = editor.store.allRecords();
      const shapes = allRecords.filter((record) => {
        if (record.typeName !== "shape") return false;
        const shape = record as DiscourseNodeShape;
        return shape.props?.uid === uid;
      }) as DiscourseNodeShape[];
      return shapes;
    },
    [editor.store],
  );

  const groupedNodes = useMemo(() => {
    const groups: NodeGroup[] = discourseNodes.map((node) => {
      const shapes = findShapesByUid(node.uid);
      return {
        uid: node.uid,
        text: node.text,
        shapes,
        isDuplicate: shapes.length > 1,
      };
    });

    return groups.sort((a, b) => a.text.localeCompare(b.text));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discourseNodes, findShapesByUid, storeVersion]);

  useEffect(() => {
    setOpenSections((prev) => {
      const next: Record<string, boolean> = {};
      groupedNodes.forEach((group) => {
        next[group.uid] = prev[group.uid] ?? group.isDuplicate;
      });

      const isSame =
        Object.keys(prev).length === Object.keys(next).length &&
        Object.entries(next).every(([key, value]) => prev[key] === value);

      return isSame ? prev : next;
    });
  }, [groupedNodes]);

  const moveCameraToShape = useCallback(
    (shapeId: string) => {
      const shape = editor.getShape(shapeId as TLShapeId);
      if (!shape) {
        return;
      }
      const x = shape.x || 0;
      const y = shape.y || 0;
      editor.centerOnPoint({ x, y }, { animation: { duration: 200 } });
      editor.select(shapeId as TLShapeId);
    },
    [editor],
  );

  const handleShapeSelection = useCallback(
    (shapeId: string) => {
      moveCameraToShape(shapeId);
    },
    [moveCameraToShape],
  );

  const handleNodeClick = useCallback(
    async (
      e: React.MouseEvent<HTMLDivElement>,
      group: NodeGroup,
      shapeId?: string,
    ) => {
      e.stopPropagation();
      // Don't navigate if we just completed a drag operation
      if (rHasDragged.current) {
        return;
      }
      if (shapeId) {
        handleShapeSelection(shapeId);
      } else if (group.shapes.length > 0) {
        handleShapeSelection(group.shapes[0].id);
      } else {
        if (e.shiftKey) {
          await openBlockInSidebar(group.uid);
        } else if (e.ctrlKey) {
          void window.roamAlphaAPI.ui.mainWindow.openPage({
            page: { uid: group.uid },
          });
        }
      }
    },
    [handleShapeSelection],
  );

  const toggleCollapse = useCallback((uid: string) => {
    setOpenSections((prevState) => ({
      ...prevState,
      [uid]: !prevState[uid],
    }));
  }, []);

  const handleDropNode = useCallback(
    async (node: { uid: string; text: string }, pagePoint: Vec) => {
      if (!extensionAPI) return;

      const nodeType = findDiscourseNode(node.uid);
      if (!nodeType) {
        internalError({
          error: new Error("Canvas Clipboard: Node type not found"),
          type: "Canvas Clipboard: Node type not found",
          context: { uid: node.uid },
        });
        return;
      }

      const title = node.text || getPageTitleByPageUid(node.uid);
      const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
        nodeText: title,
        uid: node.uid,
        nodeType: nodeType.type,
        extensionAPI,
      });

      const shapeId = createShapeId();
      const shape = {
        id: shapeId,
        type: nodeType.type,
        x: pagePoint.x - w / 2,
        y: pagePoint.y - h / 2,
        props: {
          uid: node.uid,
          title,
          w,
          h,
          imageUrl,
          size: "s" as TLDefaultSizeStyle,
          fontFamily: "sans" as TLDefaultFontStyle,
        },
      };
      editor.createShape<DiscourseNodeShape>(shape);
      editor.setCurrentTool("select");
    },
    [editor, extensionAPI],
  );

  // Drag and drop handlers
  const { handlePointerDown, handlePointerUp } = useMemo(() => {
    let target: HTMLDivElement | null = null;

    const handlePointerMove = (e: PointerEvent) => {
      const current = dragState.get();
      const screenPoint = new Vec(e.clientX, e.clientY);

      switch (current.name) {
        case "idle": {
          break;
        }
        case "pointing_item": {
          const dist = Vec.Dist(screenPoint, current.startPosition);
          if (dist > 10) {
            dragState.set({
              name: "dragging",
              node: current.node,
              currentPosition: screenPoint,
            });
          }
          break;
        }
        case "dragging": {
          dragState.set({
            ...current,
            currentPosition: screenPoint,
          });
          break;
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const current = dragState.get();
      if (e.key === "Escape" && current.name === "dragging") {
        removeEventListeners();
      }
    };

    const removeEventListeners = () => {
      if (target) {
        target.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("keydown", handleKeyDown);
      }

      dragState.set({
        name: "idle",
      });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      const current = dragState.get();

      target = e.currentTarget as HTMLDivElement;
      target.releasePointerCapture(e.pointerId);

      switch (current.name) {
        case "idle": {
          break;
        }
        case "pointing_item": {
          // If it's just a click (not a drag), do nothing (let handleNodeClick handle it)
          rHasDragged.current = false;
          dragState.set({
            name: "idle",
          });
          break;
        }
        case "dragging": {
          // When dragging ends, create the shape at the drop position
          rHasDragged.current = true;
          const pagePoint = editor.screenToPage(current.currentPosition);
          void handleDropNode(current.node, pagePoint);

          dragState.set({
            name: "idle",
          });
          // Reset the flag after a short delay to allow onClick to check it
          setTimeout(() => {
            rHasDragged.current = false;
          }, 0);
          break;
        }
      }

      removeEventListeners();
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      target = e.currentTarget as HTMLDivElement;
      target.setPointerCapture(e.pointerId);

      const nodeUid = target.dataset.clipboardNodeUid;
      const nodeText = target.dataset.clipboardNodeText;
      if (!nodeUid || !nodeText) return;

      const nodeType = findDiscourseNode(nodeUid);
      if (!nodeType) return;
      const { backgroundColor, textColor } = getDiscourseNodeColors({
        nodeType: nodeType.type,
      });

      const startPosition = new Vec(e.clientX, e.clientY);

      dragState.set({
        name: "pointing_item",
        node: { uid: nodeUid, text: nodeText, backgroundColor, textColor },
        startPosition,
      });

      target.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("keydown", handleKeyDown);
    };

    return {
      handlePointerDown,
      handlePointerUp,
    };
  }, [dragState, editor, handleDropNode]);

  const dragStateValue = useValue("clipboardDragState", () => dragState.get(), [
    dragState,
  ]);

  const zoomLevel = useValue(
    "clipboardZoomLevel",
    () => editor.getZoomLevel(),
    [editor],
  );

  // Drag preview management
  useQuickReactor(
    "clipboard-drag-image-style",
    () => {
      const current = dragState.get();
      const imageRef = rDraggingImage.current;
      const containerRef = rClipboardContainer.current;
      if (!imageRef || !containerRef) return;

      switch (current.name) {
        case "idle":
        case "pointing_item": {
          imageRef.style.display = "none";
          break;
        }
        case "dragging": {
          const { w, h } = measureCanvasNodeText({
            ...DEFAULT_STYLE_PROPS,
            maxWidth: MAX_WIDTH,
            text: current.node.text,
          });
          const zoomLevel = editor.getZoomLevel();
          const screenW = w * zoomLevel;
          const screenH = h * zoomLevel;

          let scrollableContainer: HTMLElement | null = containerRef;
          while (scrollableContainer) {
            const style = window.getComputedStyle(scrollableContainer);
            if (
              style.overflowY === "auto" ||
              style.overflowY === "scroll" ||
              style.overflow === "auto" ||
              style.overflow === "scroll"
            ) {
              break;
            }
            scrollableContainer = scrollableContainer.parentElement;
          }

          const checkContainer = scrollableContainer || containerRef;
          const containerRect = checkContainer.getBoundingClientRect();
          const box = new Box(
            containerRect.x,
            containerRect.y,
            containerRect.width,
            containerRect.height,
          );
          const isInside = Box.ContainsPoint(box, current.currentPosition);
          if (isInside) {
            imageRef.style.display = "none";
          } else {
            imageRef.style.display = "flex";
            imageRef.style.position = "fixed";
            imageRef.style.left = `${current.currentPosition.x - screenW / 2}px`;
            imageRef.style.top = `${current.currentPosition.y - screenH / 2}px`;
            imageRef.style.width = `${screenW}px`;
            imageRef.style.height = `${screenH}px`;
            imageRef.style.backgroundColor = current.node.backgroundColor;
            imageRef.style.color = current.node.textColor;
            imageRef.style.zIndex = "9999";
            imageRef.style.borderRadius = `${16 * zoomLevel}px`;
            imageRef.className =
              "roamjs-tldraw-node pointer-events-none flex fixed items-center justify-center overflow-hidden";
          }
        }
      }
    },
    [dragState, editor],
  );

  return (
    <>
      <div ref={rDraggingImage}>
        {dragStateValue.name === "dragging" && (
          <div
            className="roamjs-tldraw-node pointer-events-none flex items-center justify-center overflow-hidden"
            style={{
              background: dragStateValue.node.backgroundColor,
              color: dragStateValue.node.textColor,
              width: "100%",
              height: "100%",
            }}
          >
            <div
              style={{
                ...DEFAULT_STYLE_PROPS,
                maxWidth: "",
                fontFamily: FONT_FAMILIES.sans,
                fontSize: `${FONT_SIZES.s * zoomLevel}px`,
                padding: `${40 * zoomLevel}px`,
              }}
            >
              {dragStateValue.node.text}
            </div>
          </div>
        )}
      </div>
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="cursor-pointer"
      >
        <div className="group flex items-center">
          <Button
            small
            minimal
            icon={isOpen ? "chevron-down" : "chevron-right"}
            className="flex-shrink-0"
          />
          <span className="flex-1 rounded px-2 py-1 font-semibold">
            {page.text}
          </span>
          <Button
            minimal
            icon="minus"
            title="Remove page"
            className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(page.uid);
            }}
          />
        </div>
      </div>
      <Collapse isOpen={isOpen} keepChildrenMounted={true}>
        <div
          ref={rClipboardContainer}
          className="pl-6 pr-2 text-sm text-gray-600"
        >
          {isLoading ? (
            <div className="flex items-center gap-2 p-2">
              <Spinner size={SpinnerSize.SMALL} />
              <span>Loading nodes...</span>
            </div>
          ) : groupedNodes.length === 0 ? (
            <div className="rounded border border-dashed border-gray-200 p-2">
              No discourse nodes found on this page.
            </div>
          ) : (
            <div className="space-y-1">
              {groupedNodes.map((group) => {
                const nodeExistsInCanvas = group.shapes.length > 0;
                const isGroupOpen = openSections[group.uid] ?? false;

                if (group.isDuplicate) {
                  return (
                    <div key={group.uid} className="space-y-1">
                      <div
                        className="group flex cursor-pointer items-center gap-2 rounded bg-white p-2 hover:bg-gray-50 active:cursor-grabbing"
                        style={{ cursor: "grab" }}
                        data-clipboard-node-uid={group.uid}
                        data-clipboard-node-text={group.text}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Don't toggle if we just completed a drag operation
                          if (rHasDragged.current) {
                            return;
                          }
                          toggleCollapse(group.uid);
                        }}
                        onPointerDown={handlePointerDown}
                        onPointerUp={handlePointerUp}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Button
                              minimal
                              small
                              icon={
                                isGroupOpen ? "chevron-down" : "chevron-right"
                              }
                              className="pointer-events-none"
                            />
                            <span>{group.text}</span>
                          </div>
                          {group.isDuplicate && (
                            <Tag minimal>{group.shapes.length}</Tag>
                          )}
                        </div>
                      </div>
                      {group.isDuplicate && (
                        <Collapse isOpen={isGroupOpen}>
                          <div className="ml-5 mt-1 flex flex-col gap-1">
                            {group.shapes.map((shape, index) => (
                              <div
                                key={shape.id}
                                className="group flex items-center gap-2 rounded bg-white p-2 hover:bg-gray-50 active:cursor-grabbing"
                                style={{ cursor: "grab" }}
                                data-clipboard-node-uid={group.uid}
                                data-clipboard-node-text={group.text}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleNodeClick(e, group, shape.id);
                                }}
                                onPointerDown={handlePointerDown}
                                onPointerUp={handlePointerUp}
                              >
                                <div className="flex items-center gap-1">
                                  <Button
                                    minimal
                                    small
                                    icon="dot"
                                    className="pointer-events-none"
                                  />
                                  <span>Instance {index + 1}</span>
                                </div>
                                <Button
                                  minimal
                                  small
                                  icon="locate"
                                  title="Locate on canvas"
                                  className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                />
                              </div>
                            ))}
                          </div>
                        </Collapse>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={group.uid}
                    className="group flex items-center gap-2 rounded bg-white p-2 hover:bg-gray-50 active:cursor-grabbing"
                    style={{ cursor: "grab" }}
                    data-clipboard-node-uid={group.uid}
                    data-clipboard-node-text={group.text}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleNodeClick(e, group);
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                  >
                    <div className="flex items-center gap-1">
                      <Button
                        minimal
                        small
                        icon="dot"
                        className="pointer-events-none"
                      />
                      <span className="flex-1">{group.text}</span>
                    </div>
                    {nodeExistsInCanvas && (
                      <Button
                        minimal
                        small
                        icon="locate"
                        title="Locate on canvas"
                        className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Collapse>
    </>
  );
};

export const ClipboardPanel = () => {
  const { isOpen, pages, closeClipboard, addPage, removePage } = useClipboard();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="pointer-events-auto absolute left-20 right-0 top-2 mx-auto w-80 rounded-lg bg-white"
      style={{
        zIndex: 250,
        boxShadow:
          "0px 0px 2px hsl(0, 0%, 0%, 16%), 0px 2px 3px hsl(0, 0%, 0%, 24%), 0px 2px 6px hsl(0, 0%, 0%, 0.1), inset 0px 0px 0px 1px hsl(0, 0%, 100%)",
      }}
    >
      <div
        className="flex max-h-10 flex-shrink-0 items-center rounded-lg bg-white px-1"
        style={{ minHeight: "35px" }}
      >
        <div className="flex-shrink-0">
          <Button
            minimal
            className="pointer-events-none"
            icon={<Icon icon="clipboard" color="#5c7080" />}
          />
        </div>
        <h2 className="m-0 flex-1 pb-1 text-center text-sm font-semibold leading-tight">
          Clipboard
        </h2>
        <div className="flex-shrink-0">
          <Button
            icon={<Icon icon="minus" />}
            onClick={() => setIsCollapsed(!isCollapsed)}
            minimal
            small
            className="h-6 min-h-0 p-1"
            title={isCollapsed ? "Expand clipboard" : "Collapse clipboard"}
          />
          <Button
            icon={<Icon icon="cross" />}
            onClick={closeClipboard}
            minimal
            small
            className="h-6 min-h-0 p-1"
            title="Close clipboard"
          />
        </div>
      </div>
      {!isCollapsed && (
        <>
          <div
            className="max-h-96 overflow-y-auto p-4"
            style={{ borderTop: "1px solid hsl(0, 0%, 91%)" }}
          >
            {pages.length === 0 ? (
              <NonIdealState
                action={
                  <Button
                    icon="plus"
                    onClick={() => setIsModalOpen(true)}
                    minimal
                    small
                    text="Add page"
                  />
                }
              />
            ) : (
              <div className="space-y-2">
                {pages.map((page) => (
                  <ClipboardPageSection
                    key={page.uid}
                    page={page}
                    onRemove={removePage}
                  />
                ))}
              </div>
            )}
          </div>
          {pages.length > 0 ? (
            <div
              className="flex flex-shrink-0 items-center justify-end border-t border-gray-200 p-2"
              style={{
                borderTop: "1px solid hsl(0, 0%, 91%)",
              }}
            >
              <Button
                icon="plus"
                onClick={() => setIsModalOpen(true)}
                minimal
                small
                title="Add page"
              />{" "}
            </div>
          ) : null}
        </>
      )}

      <AddPageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={(page) => addPage(page)}
      />
    </div>
  );
};

export const ClipboardToolbarButton = () => {
  const { toggleClipboard, isOpen } = useClipboard();
  const actions = useActions();

  return (
    <TldrawUiMenuItem
      id="clipboard-toggle"
      label="Clipboard"
      icon="clipboard-copy"
      readonlyOk
      onSelect={() => {
        actions["select"];
        toggleClipboard();
      }}
      isSelected={isOpen}
    />
  );
};
