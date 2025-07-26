import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  Classes,
  InputGroup,
  HTMLSelect,
  Button,
} from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import createDiscourseNode from "~/utils/createDiscourseNode";
import { OnloadArgs } from "roamjs-components/types";
import updateBlock from "roamjs-components/writes/updateBlock";
import { render as renderToast } from "roamjs-components/components/Toast";
import getUids from "roamjs-components/dom/getUids";
import { DiscourseNode } from "~/utils/getDiscourseNodes";

export type CreateNodeDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  nodeTypes: DiscourseNode[];
  defaultNodeType: DiscourseNode;
  extensionAPI: OnloadArgs["extensionAPI"];
  blockUid?: string;
  initialTitle: string;
};

const CreateNodeDialog = ({
  isOpen,
  onClose,
  nodeTypes,
  defaultNodeType,
  extensionAPI,
  blockUid,
  initialTitle,
}: CreateNodeDialogProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [selectedType, setSelectedType] =
    useState<DiscourseNode>(defaultNodeType);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const onCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);

    const format = (
      nodeTypes.find((n) => n.type === selectedType.type)?.format || ""
    ).trim();

    let formattedTitle: string;
    if (!format) {
      formattedTitle = title.trim();
    } else if (/{content}/i.test(format)) {
      formattedTitle = format.replace(/{content}/gi, title.trim());
    } else {
      formattedTitle = `${format} ${title.trim()}`.trim();
    }

    const newPageUid = await createDiscourseNode({
      text: formattedTitle,
      configPageUid: selectedType.type,
      extensionAPI,
    });

    if (blockUid) {
      const pageRef = `[[${formattedTitle}]]`;
      await updateBlock({ uid: blockUid, text: pageRef });

      const newCursorPosition = pageRef.length;
      const windowId =
        window.roamAlphaAPI.ui.getFocusedBlock?.()?.["window-id"] || "main";

      if (window.roamAlphaAPI.ui.setBlockFocusAndSelection) {
        window.roamAlphaAPI.ui.setBlockFocusAndSelection({
          location: { "block-uid": blockUid, "window-id": windowId },
          selection: { start: newCursorPosition },
        });
      } else {
        setTimeout(() => {
          const textareaElements = document.querySelectorAll("textarea");
          for (const el of textareaElements) {
            if (getUids(el as HTMLTextAreaElement).blockUid === blockUid) {
              (el as HTMLTextAreaElement).focus();
              (el as HTMLTextAreaElement).setSelectionRange(
                newCursorPosition,
                newCursorPosition,
              );
              break;
            }
          }
        }, 50);
      }
    }

    renderToast({
      id: `discourse-node-created-${Date.now()}`,
      intent: "success",
      timeout: 10000,
      content: `Created node [[${formattedTitle}]]`,
    });
    setLoading(false);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create node"
      autoFocus={false}
    >
      <div className={Classes.DIALOG_BODY}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block font-bold">Title</label>
            <InputGroup
              placeholder={`This is a potential ${selectedType.text.toLowerCase()}`}
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              inputRef={inputRef}
            />
          </div>

          <div>
            <label className="mb-1 block font-bold">Type</label>
            <HTMLSelect
              fill
              value={selectedType.type}
              onChange={(e) => {
                const nt = nodeTypes.find(
                  (n) => n.type === e.currentTarget.value,
                );
                if (nt) setSelectedType(nt);
              }}
            >
              {nodeTypes.map((nt) => (
                <option key={nt.type} value={nt.type}>
                  {nt.text}
                </option>
              ))}
            </HTMLSelect>
          </div>
        </div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button minimal onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            intent="primary"
            onClick={onCreate}
            disabled={!title.trim() || loading}
            loading={loading}
          >
            Create
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export const renderCreateNodeDialog = (
  props: Omit<CreateNodeDialogProps, "isOpen">,
) =>
  renderOverlay({
    Overlay: CreateNodeDialog,
    props: { ...props, isOpen: true },
  });
