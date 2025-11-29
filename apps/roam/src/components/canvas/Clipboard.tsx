import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
} from "@blueprintjs/core";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import { TldrawUiMenuItem, useActions, useEditor, TLShapeId } from "tldraw";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import { Result } from "roamjs-components/types/query-builder";
import fuzzy from "fuzzy";
import { getAllReferencesOnPage } from "~/utils/hyde";
import isDiscourseNode from "~/utils/isDiscourseNode";
import { DiscourseNodeShape } from "./DiscourseNodeUtil";
import { openBlockInSidebar } from "roamjs-components/writes";

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

const ClipboardContext = createContext<ClipboardContextValue | null>(null);

const getStorageKey = () => {
  const user = getCurrentUserDisplayName();
  return `dg-clipboard-${user || "anonymous"}`;
};

export const ClipboardProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pages, setPages] = useState<ClipboardPage[]>([]);
  const storageKey = useMemo(() => getStorageKey(), []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ClipboardPage[];
        setPages(parsed);
      }
    } catch (e) {
      console.error("Failed to load clipboard state", e);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pages));
    } catch (e) {
      console.error("Failed to persist clipboard state", e);
    }
  }, [pages, storageKey]);

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
            [:find ?s ?u 
            :where 
            [?e :node/title ?s]
            [?e :block/uid ?u]]`,
        );
        const results = raw.map(([s, u]) => ({ text: s, uid: u })) as Result[];
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
              disabled={isLoading || !pageInput}
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
  const editor = useEditor();

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
        console.error("Failed to fetch discourse nodes:", error);
        setDiscourseNodes([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      void fetchDiscourseNodes();
    }
  }, [page.text, isOpen]);

  const findShapeByUid = useCallback(
    (uid: string): DiscourseNodeShape | undefined => {
      const allRecords = editor.store.allRecords();
      const shapes = allRecords.filter((record) => {
        if (record.typeName !== "shape") return false;
        const shape = record as DiscourseNodeShape;
        return shape.props?.uid === uid;
      }) as DiscourseNodeShape[];
      return shapes[0];
    },
    [editor.store],
  );

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

  const handleNodeClick = useCallback(
    async (
      e: React.MouseEvent<HTMLDivElement>,
      node: { uid: string; text: string },
    ) => {
      e.stopPropagation();
      const shape = findShapeByUid(node.uid);
      if (shape) {
        moveCameraToShape(shape.id);
      } else {
        if (e.shiftKey) {
          await openBlockInSidebar(node.uid);
        } else if (e.ctrlKey) {
          void window.roamAlphaAPI.ui.mainWindow.openPage({
            page: { uid: node.uid },
          });
        }
      }
    },
    [findShapeByUid, moveCameraToShape, openBlockInSidebar],
  );

  return (
    <>
      {" "}
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
        <div className="pl-6 pr-2 text-sm text-gray-600">
          {isLoading ? (
            <div className="flex items-center gap-2 p-2">
              <Spinner size={SpinnerSize.SMALL} />
              <span>Loading nodes...</span>
            </div>
          ) : discourseNodes.length === 0 ? (
            <div className="rounded border border-dashed border-gray-200 p-2">
              No discourse nodes found on this page.
            </div>
          ) : (
            <div className="space-y-1">
              {discourseNodes.map((node) => {
                const shape = findShapeByUid(node.uid);
                const nodeExistsInCanvas = !!shape;

                return (
                  <div
                    key={node.uid}
                    className="group flex cursor-pointer items-center gap-2 rounded bg-white p-2 hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeClick(e, node);
                    }}
                  >
                    <span className="flex-1">{node.text}</span>
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
            // onClick={closeClipboard}
            className="pointer-events-none"
            icon={<Icon icon="clipboard" color="#5c7080" />}
          />
        </div>
        <h2 className="m-0 flex-1 pb-1 text-center text-sm font-semibold leading-tight">
          Clipboard
        </h2>
        <div className="flex-shrink-0">
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
      icon="clipboard"
      readonlyOk
      onSelect={() => {
        actions["select"]; // touch actions to satisfy hook rules
        toggleClipboard();
      }}
      isSelected={isOpen}
    />
  );
};
