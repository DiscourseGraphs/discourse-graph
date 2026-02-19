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
import {
  getNewDiscourseNodeText,
  getReferencedNodeInFormat,
} from "~/utils/formatUtils";
import createDiscourseNode from "~/utils/createDiscourseNode";
import { OnloadArgs } from "roamjs-components/types";
import { render as renderToast } from "roamjs-components/components/Toast";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import resolveQueryBuilderRef from "~/utils/resolveQueryBuilderRef";
import runQuery from "~/utils/runQuery";

export type ModifyNodeDialogMode = "create" | "edit";
export type ModifyNodeDialogProps = {
  mode: ModifyNodeDialogMode;
  nodeType: string;
  initialValue: { text: string; uid: string };
  initialReferencedNode?: { text: string; uid: string };
  sourceBlockUid?: string; //the block that we started modifying from
  extensionAPI?: OnloadArgs["extensionAPI"];
  includeDefaultNodes?: boolean; // Include default nodes (Page, Block) in node type selector
  imageUrl?: string; // For image conversion from canvas
  onSuccess: (result: {
    text: string;
    uid: string;
    action: string;
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
  includeDefaultNodes = false,
  imageUrl,
  onSuccess,
  onClose,
}: RoamOverlayProps<ModifyNodeDialogProps>) => {
  const [content, setContent] = useState<Result>({
    text: initialValue.text,
    uid: initialValue.uid,
  });
  const [referencedNodeValue, setReferencedNodeValue] = useState<Result>({
    text: initialReferencedNode?.text || "",
    uid: initialReferencedNode?.uid || "",
  });

  const isContentLocked = useMemo(
    () =>
      Boolean(
        content.uid && content.uid !== initialValue.uid && mode === "create",
      ),
    [content.uid, initialValue.uid, mode],
  );
  const isReferencedNodeLocked = useMemo(
    () =>
      Boolean(
        referencedNodeValue.uid &&
          referencedNodeValue.uid !== initialReferencedNode?.uid,
      ),
    [referencedNodeValue.uid, initialReferencedNode?.uid],
  );

  const [options, setOptions] = useState<{
    content: Result[];
    referencedNode: Result[];
  }>({ content: [], referencedNode: [] });

  const [loading, setLoading] = useState(false);

  const contentRequestIdRef = useRef(0);
  const referencedNodeRequestIdRef = useRef(0);
  const [error, setError] = useState("");

  const discourseNodes = useMemo(() => {
    const allNodes = getDiscourseNodes();
    return includeDefaultNodes
      ? allNodes
      : allNodes.filter(excludeDefaultNodes);
  }, [includeDefaultNodes]);

  const [selectedNodeType, setSelectedNodeType] = useState(() => {
    const node = discourseNodes.find((n) => n.type === nodeType);
    return node || discourseNodes[0];
  });

  const nodeFormat = useMemo(() => {
    return selectedNodeType.format || "";
  }, [selectedNodeType]);

  const referencedNode = useMemo(() => {
    const refNode = getReferencedNodeInFormat({
      format: nodeFormat,
    });

    if (!refNode) return null;

    return {
      name: refNode.text,
      nodeType: refNode.type,
    };
  }, [nodeFormat]);

  useEffect(() => {
    setLoading(true);

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
          if (contentRequestIdRef.current === req && alive) {
            setOptions((prev) => ({ ...prev, content: results }));
          }
        }
      } catch (error) {
        if (contentRequestIdRef.current === req && alive) {
          renderToast({
            id: `discourse-node-error-${Date.now()}`,
            intent: "danger",
            content: (
              <span>Error fetching content options: {String(error)}</span>
            ),
          });
        }
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
          setOptions((prev) => ({ ...prev, referencedNode: results }));
        }
      } catch (error) {
        if (referencedNodeRequestIdRef.current === refReq && refAlive) {
          renderToast({
            id: `discourse-node-error-${Date.now()}`,
            intent: "danger",
            content: (
              <span>
                Error fetching referenced node options: {String(error)}
              </span>
            ),
          });
        }
      }
    };

    void (async () => {
      const promises = [fetchOptions()];
      if (referencedNode) {
        promises.push(fetchReferencedOptions());
      }
      await Promise.all(promises);
      if (contentRequestIdRef.current === req && alive) {
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      refAlive = false;
    };
  }, [selectedNodeType, referencedNode]);

  const setValue = useCallback((r: Result) => {
    setContent(r);
  }, []);

  const setReferencedNodeValueCallback = useCallback((r: Result) => {
    setReferencedNodeValue(r);
  }, []);

  const onCancelClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const addImageToPage = useCallback(
    async ({
      pageUid,
      imageUrl,
      configPageUid,
      extensionAPI,
    }: {
      pageUid: string;
      imageUrl: string;
      configPageUid: string;
      extensionAPI?: OnloadArgs["extensionAPI"];
    }) => {
      const discourseNodes = getDiscourseNodes();
      const canvasSettings = Object.fromEntries(
        discourseNodes.map((n) => [n.type, { ...n.canvasSettings }]),
      );
      const {
        "query-builder-alias": qbAlias = "",
        "key-image": isKeyImage = "",
        "key-image-option": keyImageOption = "",
      } = canvasSettings[configPageUid] || {};

      const createOrUpdateImageBlock = async (imagePlaceholderUid?: string) => {
        const imageMarkdown = `![](${imageUrl})`;
        if (imagePlaceholderUid) {
          await updateBlock({
            uid: imagePlaceholderUid,
            text: imageMarkdown,
          });
        } else {
          await createBlock({
            node: { text: imageMarkdown },
            order: 0,
            parentUid: pageUid,
          });
        }
      };

      if (!isKeyImage || !extensionAPI) {
        await createOrUpdateImageBlock();
        return;
      }

      if (keyImageOption === "query-builder") {
        const parentUid = resolveQueryBuilderRef({
          queryRef: qbAlias,
          extensionAPI,
        });
        const results = await runQuery({
          extensionAPI,
          parentUid,
          // due to query format
          // eslint-disable-next-line @typescript-eslint/naming-convention
          inputs: { NODETEXT: content.text, NODEUID: pageUid },
        });
        const imagePlaceholderUid = results.allProcessedResults[0]?.uid;
        await createOrUpdateImageBlock(imagePlaceholderUid);
      } else {
        await createOrUpdateImageBlock();
      }
    },
    [content.text],
  );

  const onSubmit = async () => {
    if (!content.text.trim()) return;
    try {
      if (mode === "create") {
        // If content is locked (user selected existing node), just insert it
        if (isContentLocked && content.uid) {
          if (sourceBlockUid) {
            const pageRef = `[[${content.text}]]`;
            await updateBlock({
              uid: sourceBlockUid,
              text: pageRef,
            });
          }

          if (imageUrl) {
            const pageUid = content.uid || getPageUidByPageTitle(content.text);
            if (pageUid) {
              await addImageToPage({
                pageUid,
                imageUrl,
                configPageUid: selectedNodeType.type,
                extensionAPI,
              });
            }
          }

          await onSuccess({
            text: content.text,
            uid: content.uid,
            action: "create",
          });

          onClose();
          return;
        }

        // Format content with referenced node if present
        let formattedTitle = "";
        if (referencedNode && referencedNodeValue.text) {
          // Format the referenced node if it's new
          let formattedReferencedNodeText = referencedNodeValue.text;
          if (!isReferencedNodeLocked) {
            const formattedRefNode = await getNewDiscourseNodeText({
              text: referencedNodeValue.text.trim(),
              nodeType: referencedNode.nodeType,
              blockUid: sourceBlockUid,
            });
            if (!formattedRefNode) {
              return;
            }
            formattedReferencedNodeText = formattedRefNode;
          }

          formattedTitle = nodeFormat.replace(
            /{([\w\d-]*)}/g,
            // unused variable will take _ as name
            // eslint-disable-next-line @typescript-eslint/naming-convention
            (_, val: string) => {
              if (/content/i.test(val)) return content.text.trim();
              if (new RegExp(referencedNode.name, "i").test(val))
                return `[[${formattedReferencedNodeText}]]`;
              return "";
            },
          );
        } else {
          formattedTitle = await getNewDiscourseNodeText({
            text: content.text.trim(),
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
          imageUrl,
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
                          // eslint-disable-next-line @typescript-eslint/naming-convention
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
          uid: newPageUid,
          action: "create",
        });
      } else {
        // Edit mode: update the existing block
        let updatedContent = content.text;

        // Format with referenced node if present
        if (referencedNode && referencedNodeValue.text) {
          updatedContent = nodeFormat
            // unused variable will take _ as name
            // eslint-disable-next-line @typescript-eslint/naming-convention
            .replace(/{([\w\d-]*)}/g, (_, val: string) => {
              if (/content/i.test(val)) return content.text.trim();
              if (new RegExp(referencedNode.name, "i").test(val))
                return `[[${referencedNodeValue.text}]]`;
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
          uid: sourceBlockUid || content.uid,
          action: "edit",
        });
      }
      onClose();
    } catch (error) {
      setError((error as Error).message);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      canEscapeKeyClose
      autoFocus={false}
      enforceFocus={false}
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
        <div className={`${Classes.DIALOG_BODY} flex flex-col gap-4`}>
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
              value={content}
              setValue={setValue}
              options={options.content}
              placeholder={
                loading
                  ? "..."
                  : `Enter a ${selectedNodeType.text.toLowerCase()} ...`
              }
              mode={mode}
              initialUid={content.uid}
              autoFocus
            />
          </div>

          {/* Referenced Node Input */}
          {referencedNode && !isContentLocked && mode === "create" && (
            <div className="w-full">
              <Label>{referencedNode.name}</Label>
              <FuzzySelectInput
                value={referencedNodeValue}
                setValue={setReferencedNodeValueCallback}
                options={options.referencedNode}
                placeholder={loading ? "..." : "Select a referenced node"}
                mode={"create"}
                initialUid={referencedNodeValue.uid}
                initialIsLocked={isReferencedNodeLocked}
                autoFocus={false}
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
              disabled={loading || !content.text.trim()}
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
      </div>
    </Dialog>
  );
};

export const renderModifyNodeDialog = (props: ModifyNodeDialogProps) =>
  renderOverlay({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Overlay: ModifyNodeDialog,
    props,
  });

export default ModifyNodeDialog;
