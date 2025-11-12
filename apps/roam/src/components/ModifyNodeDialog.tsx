import {
  Button,
  Classes,
  Dialog,
  Intent,
  Label,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { Result } from "~/utils/types";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import fireQuery from "~/utils/fireQuery";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import FuzzySelectInput from "./FuzzySelectInput";
import { createBlock, updateBlock } from "roamjs-components/writes";
import { getNewDiscourseNodeText } from "~/utils/formatUtils";
import createDiscourseNode from "~/utils/createDiscourseNode";
import { OnloadArgs } from "roamjs-components/types";
import { render as renderToast } from "roamjs-components/components/Toast";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";

export type ModifyNodeDialogMode = "create" | "edit";
export type ModifyNodeDialogProps = {
  mode: ModifyNodeDialogMode;
  nodeType: string;
  initialValue: { text: string; uid: string };
  initialReferencedNode?: { text: string; uid: string };
  sourceBlockUid?: string; //the block that we started modifying from
  extensionAPI?: OnloadArgs["extensionAPI"];
  isFromCanvas?: boolean;
  onSuccess: (result: {
    text: string;
    uid: string;
    action: string;
    newPageUid?: string;
  }) => Promise<void>;
  onClose: () => void;
};

const ModifyNodeDialog = ({
  isOpen,
  mode,
  nodeType,
  initialValue,
  initialReferencedNode,
  sourceBlockUid,
  extensionAPI,
  isFromCanvas = false,
  onSuccess,
  onClose,
}: RoamOverlayProps<ModifyNodeDialogProps>) => {
  const [contentText, setContentText] = useState(initialValue.text);
  const [contentUid, setContentUid] = useState(initialValue.uid);
  const [referencedNodeText, setReferencedNodeText] = useState(
    initialReferencedNode?.text || "",
  );
  const [referencedNodeUid, setReferencedNodeUid] = useState(
    initialReferencedNode?.uid || "",
  );
  const [isContentLocked, setIsContentLocked] = useState(false);
  const [contentOptions, setContentOptions] = useState<Result[]>([]);
  const [referencedNodeOptions, setReferencedNodeOptions] = useState<Result[]>(
    [],
  );
  const [contentLoading, setContentLoading] = useState(false);
  const [referencedNodeLoading, setReferencedNodeLoading] = useState(false);
  const contentRequestIdRef = useRef(0);
  const referencedNodeRequestIdRef = useRef(0);
  const [error, setError] = useState("");

  const discourseNodes = useMemo(() => {
    const allNodes = getDiscourseNodes();
    // Allow default nodes when opened from canvas, exclude them otherwise
    return isFromCanvas ? allNodes : allNodes.filter(excludeDefaultNodes);
  }, [isFromCanvas]);

  const [selectedNodeType, setSelectedNodeType] = useState(() => {
    const node = discourseNodes.find((n) => n.type === nodeType);
    return node || discourseNodes[0];
  });

  const nodeFormat = useMemo(() => {
    return selectedNodeType.format || "";
  }, [selectedNodeType]);

  const referencedNode = useMemo(() => {
    const regex = /{([\w\d-]*)}/g;
    const matches = [...nodeFormat.matchAll(regex)];

    for (const match of matches) {
      const val = match[1];
      if (val.toLowerCase() === "content") continue;
      if (val.toLowerCase() === "context") continue;

      const allNodes = isFromCanvas
        ? getDiscourseNodes()
        : getDiscourseNodes().filter(excludeDefaultNodes);

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
  }, [nodeFormat, isFromCanvas]);

  useEffect(() => {
    setContentLoading(true);

    let alive = true;
    const req = ++contentRequestIdRef.current;

    let refAlive = true;
    const refReq = ++referencedNodeRequestIdRef.current;

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
          if (contentRequestIdRef.current === req && alive)
            setContentOptions(results);
        }
      } catch (error) {
        if (contentRequestIdRef.current === req && alive) {
          console.error("Error fetching content options:", error);
        }
      } finally {
        if (contentRequestIdRef.current === req && alive)
          setContentLoading(false);
      }
    };

    const fetchReferencedOptions = async () => {
      if (!referencedNode) return;
      try {
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
        if (referencedNodeRequestIdRef.current === refReq && refAlive) {
          setReferencedNodeOptions(results);
        }
      } catch (error) {
        if (referencedNodeRequestIdRef.current === refReq && refAlive) {
          console.error("Error fetching referenced node options:", error);
        }
      } finally {
        if (referencedNodeRequestIdRef.current === refReq && refAlive) {
          setReferencedNodeLoading(false);
        }
      }
    };

    void fetchOptions();
    void fetchReferencedOptions();
    return () => {
      alive = false;
      refAlive = false;
    };
  }, [selectedNodeType, referencedNode]);

  useEffect(() => {
    if (mode === "edit" && referencedNode) {
      setReferencedNodeLoading(true);
      // TODO: replace this with a regex. this is extremely hacky primitive
      const parseResult = contentText.trim().split("-");
      if (parseResult) {
        // parseResult[1] is content, parseResult[2] is refnode
        if (parseResult[1]) {
          setContentText(parseResult[1].trim());
        }
        if (parseResult[2]) {
          const refText = parseResult[2].trim().replace(/[[\]]/g, "");
          setReferencedNodeText(refText);
          const result = getPageUidByPageTitle(refText);
          setReferencedNodeUid(result);
        }
      }
    }
    setReferencedNodeLoading(false);
  }, [mode, referencedNode, nodeFormat, contentText]);

  const setValue = useCallback((r: Result) => {
    setContentText(r.text);
    setContentUid(r.uid);
  }, []);

  const setReferencedNodeValue = useCallback((r: Result) => {
    setReferencedNodeText(r.text);
    setReferencedNodeUid(r.uid);
  }, []);

  const onCancelClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const onSubmit = async () => {
    if (!contentText.trim()) return;
    try {
      if (mode === "create") {
        // If content is locked (user selected existing node), just insert it
        if (isContentLocked && contentUid) {
          if (sourceBlockUid) {
            const pageRef = `[[${contentText}]]`;
            await updateBlock({
              uid: sourceBlockUid,
              text: pageRef,
            });
          }

          await onSuccess({
            text: contentText,
            uid: contentUid,
            action: "create",
          });

          onClose();
          return;
        }

        // Format content with referenced node if present
        let formattedTitle = "";
        if (referencedNode && referencedNodeText) {
          formattedTitle = nodeFormat.replace(
            /{([\w\d-]*)}/g,
            (_, val: string) => {
              if (/content/i.test(val)) return contentText.trim();
              if (new RegExp(referencedNode.name, "i").test(val))
                return `[[${referencedNodeText}]]`;
              return "";
            },
          );
        } else {
          formattedTitle = await getNewDiscourseNodeText({
            text: contentText.trim(),
            nodeType: selectedNodeType.type,
            blockUid: sourceBlockUid,
          });
        }
        if (!formattedTitle) {
          return;
        }

        // Create new discourse node
        const newPageUid = await createDiscourseNode({
          text: formattedTitle,
          configPageUid: selectedNodeType.type,
          extensionAPI,
        });

        if (sourceBlockUid) {
          const pageRef = `[[${formattedTitle}]]`;
          await updateBlock({
            uid: sourceBlockUid,
            text: pageRef,
          });
          if (initialValue.text && initialValue.text.trim()) {
            await createBlock({
              parentUid: sourceBlockUid,
              order: 0,
              node: {
                text: initialValue.text,
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
          uid: contentUid,
          action: "create",
          newPageUid,
        });
      } else {
        // Edit mode: update the existing block
        let updatedContent = contentText;

        // Format with referenced node if present
        if (referencedNode && referencedNodeText) {
          updatedContent = nodeFormat
            .replace(/{([\w\d-]*)}/g, (_, val: string) => {
              if (/content/i.test(val)) return contentText.trim();
              if (new RegExp(referencedNode.name, "i").test(val))
                return `[[${referencedNodeText}]]`;
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
          uid: sourceBlockUid || contentUid,
          action: "edit",
        });
      }
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setContentLoading(false);
      setReferencedNodeLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      canEscapeKeyClose
      autoFocus={false}
      className={"roamjs-canvas-dialog"}
    >
      <div
        // Prevents TLDraw from hijacking onClick and onMouseup
        // https://discord.com/channels/859816885297741824/1209834682384912397
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: "all" }}
      >
        <div className={Classes.DIALOG_BODY}>
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
                    setReferencedNodeValue({ text: "", uid: "" });
                  }
                }}
                disabled={mode === "edit"}
              />
            </Label>
          </div>

          {/* Content Input */}
          <div className="w-full">
            <Label>Content</Label>
            <FuzzySelectInput
              value={{ text: contentText, uid: contentUid }}
              setValue={setValue}
              options={contentOptions}
              placeholder={
                contentLoading
                  ? "..."
                  : `Enter a ${selectedNodeType.text.toLowerCase()} ...`
              }
              disabled={contentLoading}
              onLockedChange={setIsContentLocked}
              mode={mode}
              initialUid={contentUid}
            />
          </div>

          {/* Referenced Node Input */}
          {referencedNode && !isContentLocked && (
            <div className="w-full">
              <Label>{referencedNode.name}</Label>
              <FuzzySelectInput
                value={{
                  text: referencedNodeText || "",
                  uid: referencedNodeUid || "",
                }}
                setValue={setReferencedNodeValue}
                options={referencedNodeOptions}
                placeholder={
                  referencedNodeLoading ? "..." : "Select a referenced node"
                }
                disabled={referencedNodeLoading}
                mode={"create"}
                initialUid={referencedNodeUid}
              />
            </div>
          )}
        </div>
        {/* Submit Button */}
        <div className={Classes.DIALOG_FOOTER}>
          <div
            className={`${Classes.DIALOG_FOOTER_ACTIONS} flex-row-reverse items-center`}
          >
            <Button
              text="Confirm"
              intent={Intent.PRIMARY}
              onClick={() => void onSubmit()}
              disabled={contentLoading || !contentText.trim()}
              className="flex-shrink-0"
            />
            <Button
              text="Cancel"
              onClick={onCancelClick}
              disabled={contentLoading}
              className="flex-shrink-0"
            />
            <span className="flex-grow text-red-800">{error}</span>
            {contentLoading && <Spinner size={SpinnerSize.SMALL} />}
          </div>
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
