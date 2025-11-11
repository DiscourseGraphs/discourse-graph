/* eslint-disable @typescript-eslint/naming-convention */
import React, {
  useRef,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import {
  Button,
  Classes,
  Dialog,
  Intent,
  Spinner,
  SpinnerSize,
  Label,
} from "@blueprintjs/core";
import fuzzy from "fuzzy";
import { OnloadArgs } from "roamjs-components/types";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import LockableAutocompleteInput from "./LockableAutocompleteInput";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { render as renderToast } from "roamjs-components/components/Toast";
import updateBlock from "roamjs-components/writes/updateBlock";
import createBlock from "roamjs-components/writes/createBlock";
import fireQuery from "~/utils/fireQuery";
import createDiscourseNode from "~/utils/createDiscourseNode";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import { getNewDiscourseNodeText } from "~/utils/formatUtils";
import { Result } from "~/utils/types";
import { DiscourseContextType } from "./canvas/Tldraw";
import FuzzySelectInput from "./FuzzySelectInput";

type ReferencedNode = {
  name: string;
  nodeType: string;
  value?: string;
};

export type ModifyNodeDialogProps = {
  mode: "create" | "edit";
  nodeType: string;
  content: string;
  uid?: string;
  referencedNode?: ReferencedNode | null;
  onSuccess: (result: {
    text: string;
    uid: string;
    action: string;
    newPageUid?: string;
  }) => Promise<void>;
  onClose: () => void;
  extensionAPI: OnloadArgs["extensionAPI"];
  sourceBlockUid?: string;
  refBlockUid?: string;
  discourseContext?: DiscourseContextType;
};

const ModifyNodeDialog = ({
  isOpen,
  onClose,
  mode,
  nodeType: initialNodeType,
  content: initialContent,
  uid: initialUid,
  onSuccess,
  extensionAPI,
  sourceBlockUid,
  // refBlockUid, // TODO: Re-enable when implementing referenced node auto-population
  discourseContext,
}: RoamOverlayProps<ModifyNodeDialogProps>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRequestIdRef = useRef(0);
  const referencedNodeRequestIdRef = useRef(0);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReferencedNodeLoading, setIsReferencedNodeLoading] = useState(false);

  const discourseNodes = useMemo(
    () => getDiscourseNodes().filter(excludeDefaultNodes),
    [],
  );

  const [selectedNodeType, setSelectedNodeType] = useState(() => {
    const node = discourseNodes.find((n) => n.type === initialNodeType);
    return node || discourseNodes[0];
  });

  const [options, setOptions] = useState<Result[]>([]);
  const [content, setContent] = useState(initialContent);
  const [contentUid, setContentUid] = useState(initialUid || "");
  const [isContentLocked, setIsContentLocked] = useState(false);

  const [referencedNodeOptions, setReferencedNodeOptions] = useState<Result[]>(
    [],
  );
  const [referencedNodeValue, setReferencedNodeValue] = useState("");
  const [referencedNodeUid, setReferencedNodeUid] = useState("");

  const isCreateMode = mode === "create";

  // Generate stable UIDs for tracking new vs existing nodes
  const contentInitialUid = useMemo(
    () => initialUid || window.roamAlphaAPI.util.generateUID(),
    [initialUid],
  );
  const referencedNodeInitialUid = useMemo(
    () => window.roamAlphaAPI.util.generateUID(),
    [],
  );

  // Get node format and referenced node info
  const nodeFormat = useMemo(() => {
    if (discourseContext) {
      return discourseContext.nodes[selectedNodeType.type]?.format || "";
    }
    return selectedNodeType.format || "";
  }, [selectedNodeType, discourseContext]);

  const referencedNode = useMemo(() => {
    const regex = /{([\w\d-]*)}/g;
    const matches = [...nodeFormat.matchAll(regex)];

    for (const match of matches) {
      const val = match[1];
      if (val.toLowerCase() === "content") continue;
      if (val.toLowerCase() === "context") continue;

      const allNodes = discourseContext
        ? Object.values(discourseContext.nodes)
        : discourseNodes;

      const refNode = allNodes.find(({ text }) =>
        new RegExp(text, "i").test(val),
      );

      if (refNode) {
        return {
          name: refNode.text,
          nodeType: refNode.type,
        };
      }
    }

    return null;
  }, [nodeFormat, discourseNodes, discourseContext]);

  // Fetch options for main content autocomplete
  useEffect(() => {
    let alive = true;
    const req = ++contentRequestIdRef.current;
    setIsLoading(true);

    const fetchOptions = async () => {
      try {
        if (selectedNodeType) {
          const conditionUid = window.roamAlphaAPI.util.generateUID();
          const results = await fireQuery({
            returnNode: "node",
            selections: [],
            conditions: [
              {
                source: "node",
                relation: "is a",
                target: selectedNodeType.type,
                uid: conditionUid,
                type: "clause",
              },
            ],
          });
          if (contentRequestIdRef.current === req && alive) setOptions(results);
        }
      } catch (error) {
        if (contentRequestIdRef.current === req && alive) {
          console.error("Error fetching content options:", error);
        }
      } finally {
        if (contentRequestIdRef.current === req && alive) setIsLoading(false);
      }
    };

    void fetchOptions();
    return () => {
      alive = false;
    };
  }, [selectedNodeType]);

  // Fetch options for referenced node autocomplete
  useEffect(() => {
    if (!referencedNode) return;

    let alive = true;
    const req = ++referencedNodeRequestIdRef.current;

    const fetchReferencedOptions = async () => {
      try {
        setIsReferencedNodeLoading(true);
        const conditionUid = window.roamAlphaAPI.util.generateUID();
        const results = await fireQuery({
          returnNode: "node",
          selections: [],
          conditions: [
            {
              source: "node",
              relation: "is a",
              target: referencedNode.nodeType,
              uid: conditionUid,
              type: "clause",
            },
          ],
        });
        if (referencedNodeRequestIdRef.current === req && alive) {
          setReferencedNodeOptions(results);
        }
      } catch (error) {
        if (referencedNodeRequestIdRef.current === req && alive) {
          console.error("Error fetching referenced node options:", error);
        }
      } finally {
        if (referencedNodeRequestIdRef.current === req && alive)
          setIsReferencedNodeLoading(false);
      }
    };

    void fetchReferencedOptions();
    return () => {
      alive = false;
    };
  }, [referencedNode]);

  const setValue = useCallback((r: Result) => {
    setContent(r.text);
    setContentUid(r.uid);
  }, []);

  const setValueFromReferencedNode = useCallback(
    (r: Result) => {
      if (!referencedNode) return;
      setReferencedNodeValue(r.text);
      setReferencedNodeUid(r.uid);
    },
    [referencedNode],
  );

  const onNewItem = useCallback(
    (text: string) => ({
      text,
      uid: contentInitialUid,
    }),
    [contentInitialUid],
  );

  const onNewReferencedNodeItem = useCallback(
    (text: string) => ({
      text,
      uid: referencedNodeInitialUid,
    }),
    [referencedNodeInitialUid],
  );

  const itemToQuery = useCallback((result?: Result) => result?.text || "", []);

  const filterOptions = useCallback(
    (o: Result[], q: string) =>
      fuzzy
        .filter(q, o, { extract: itemToQuery })
        .map((f) => f.original)
        .filter((f): f is Result => !!f),
    [itemToQuery],
  );

  const onSubmit = async () => {
    if (!content.trim()) return;

    setLoading(true);
    setError("");

    try {
      const action = isCreateMode ? "creating" : "editing";

      if (action === "creating") {
        // If content is locked (user selected existing node), just insert it
        if (isContentLocked && contentUid) {
          if (sourceBlockUid) {
            const pageRef = `[[${content}]]`;
            await updateBlock({
              uid: sourceBlockUid,
              text: pageRef,
            });
          }

          await onSuccess({
            text: content,
            uid: contentUid,
            action,
          });

          onClose();
          return;
        }

        // Format content with referenced node if present
        let formattedTitle = "";
        if (referencedNode && referencedNodeValue) {
          formattedTitle = nodeFormat.replace(
            /{([\w\d-]*)}/g,
            (_, val: string) => {
              if (/content/i.test(val)) return content.trim();
              if (new RegExp(referencedNode.name, "i").test(val))
                return `[[${referencedNodeValue}]]`;
              return "";
            },
          );
          console.log("formattedTitle", formattedTitle);
        } else {
          formattedTitle = await getNewDiscourseNodeText({
            text: content.trim(),
            nodeType: selectedNodeType.type,
            blockUid: sourceBlockUid,
          });
        }

        if (!formattedTitle) {
          setLoading(false);
          return;
        }

        // Create new discourse node
        const newPageUid = await createDiscourseNode({
          text: formattedTitle,
          configPageUid: selectedNodeType.type,
          extensionAPI,
        });

        // Handle source block update if needed
        if (sourceBlockUid) {
          const pageRef = `[[${formattedTitle}]]`;
          await updateBlock({
            uid: sourceBlockUid,
            text: pageRef,
          });
          if (initialContent && initialContent.trim()) {
            await createBlock({
              parentUid: sourceBlockUid,
              order: 0,
              node: {
                text: initialContent,
              },
            });
          }
        }

        renderToast({
          id: `discourse-node-created-${Date.now()}`,
          intent: "success",
          timeout: 10000,
          content: (
            <span>
              Created node{" "}
              <a
                className="cursor-pointer font-medium text-blue-500 hover:underline"
                onClick={(event) => {
                  void (async () => {
                    if (event.shiftKey) {
                      await window.roamAlphaAPI.ui.rightSidebar.addWindow({
                        window: {
                          // @ts-expect-error TODO: fix this
                          "block-uid": newPageUid,
                          type: "outline",
                        },
                      });
                    } else {
                      await window.roamAlphaAPI.ui.mainWindow.openPage({
                        page: { uid: newPageUid },
                      });
                    }
                  })();
                }}
              >
                [[{formattedTitle}]]
              </a>
            </span>
          ),
        });

        await onSuccess({
          text: formattedTitle,
          uid: sourceBlockUid || newPageUid,
          action,
          newPageUid,
        });
      } else {
        // Edit mode: update the existing block
        let updatedContent = content;

        // Format with referenced node if present
        if (referencedNode && referencedNodeValue) {
          updatedContent = nodeFormat
            .replace(/{([\w\d-]*)}/g, (_, val: string) => {
              if (/content/i.test(val)) return content.trim();
              if (new RegExp(referencedNode.name, "i").test(val))
                return `[[${referencedNodeValue}]]`;
              return "";
            })
            .trim();
        }

        if (sourceBlockUid) {
          await updateBlock({
            uid: sourceBlockUid,
            text: updatedContent,
          });

          renderToast({
            id: `discourse-node-edited-${Date.now()}`,
            intent: "success",
            timeout: 5000,
            content: "Node updated successfully",
          });
        }

        await onSuccess({
          text: updatedContent,
          uid: contentUid,
          action,
        });
      }

      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onCancelClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // Auto-populate referenced node from refBlockUid if provided
  // useEffect(() => {
  //   if (refBlockUid && referencedNode) {
  //     const refBlock = window.roamAlphaAPI.data.pull(
  //       "[:block/string :block/uid]",
  //       [":block/uid", refBlockUid],
  //     );
  //     if (refBlock && refBlock[":block/string"]) {
  //       const refText = String(refBlock[":block/string"]);
  //       setReferencedNodeValue(refText);
  //       setReferencedNodeUid(refBlockUid);
  //       setIsReferencedNodeLocked(true);
  //     }
  //   }
  // }, [refBlockUid, referencedNode]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancelClick}
      canEscapeKeyClose
      autoFocus={false}
      title={`${isCreateMode ? "Create" : "Edit"} Discourse Node`}
      className="roamjs-discourse-node-dialog"
    >
      <div
        className={`${Classes.DIALOG_BODY} flex flex-col gap-4`}
        ref={containerRef}
      >
        {/* Node Type Selector */}
        <div className="flex w-full">
          <Label>
            Node Type
            <MenuItemSelect
              items={discourseNodes.map((n) => n.type)}
              transformItem={(t) =>
                discourseNodes.find((n) => n.type === t)?.text || t
              }
              activeItem={selectedNodeType.type}
              onItemSelect={(t) => {
                const nt = discourseNodes.find((n) => n.type === t);
                if (nt) {
                  setSelectedNodeType(nt);
                  setReferencedNodeValue("");
                }
              }}
            />
          </Label>
        </div>

        {/* Content Input */}
        {/* <div className="w-full">
          <Label>Content</Label>
          <div className="w-full">
            <LockableAutocompleteInput
              value={{ text: content, uid: contentUid }}
              setValue={setValue}
              options={options}
              multiline
              autoFocus
              onNewItem={onNewItem}
              itemToQuery={itemToQuery}
              filterOptions={filterOptions}
              disabled={isLoading}
              placeholder={
                isLoading
                  ? "Loading ..."
                  : `Enter ${selectedNodeType.text.toLowerCase()} content ...`
              }
              maxItemsDisplayed={100}
              onLockedChange={setIsContentLocked}
              mode={mode}
              initialUid={contentInitialUid}
            />
          </div>
        </div> */}

        {/* Referenced Node Section - hidden when content is locked */}
        {/* {referencedNode && !isContentLocked && (
          <div className="referenced-node-autocomplete w-full">
            <Label>{referencedNode.name}</Label>
            <div className="w-full">
              <LockableAutocompleteInput
                value={
                  referencedNodeValue
                    ? { text: referencedNodeValue, uid: referencedNodeUid }
                    : { text: "", uid: "" }
                }
                setValue={setValueFromReferencedNode}
                options={referencedNodeOptions}
                multiline
                onNewItem={onNewReferencedNodeItem}
                itemToQuery={itemToQuery}
                filterOptions={filterOptions}
                placeholder={
                  isReferencedNodeLoading
                    ? "..."
                    : `Enter a ${referencedNode.name} ...`
                }
                disabled={isReferencedNodeLoading}
                maxItemsDisplayed={100}
                mode="create"
                initialUid={referencedNodeInitialUid}
              />
            </div>
          </div>
        )} */}

        <FuzzySelectInput
          value={{ text: content, uid: contentUid }}
          setValue={setValue}
          options={options}
          placeholder={
            isReferencedNodeLoading
              ? "..."
              : `Enter a ${selectedNodeType.text.toLowerCase()} ...`
          }
          disabled={isLoading}
          onLockedChange={setIsContentLocked}
          mode={mode}
          initialUid={contentInitialUid}
        />
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div
          className={`${Classes.DIALOG_FOOTER_ACTIONS} flex-row-reverse items-center`}
        >
          <Button
            text="Confirm"
            intent={Intent.PRIMARY}
            onClick={() => void onSubmit()}
            disabled={loading || !content.trim()}
            className="flex-shrink-0"
          />
          <Button
            text="Cancel"
            onClick={onCancelClick}
            disabled={loading}
            className="flex-shrink-0"
          />
          <span className="flex-grow text-red-800">{error}</span>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
        </div>
      </div>
    </Dialog>
  );
};

export const renderModifyNodeDialog = (props: ModifyNodeDialogProps) =>
  renderOverlay({
    Overlay: ModifyNodeDialog,
    props,
  });

export default ModifyNodeDialog;

