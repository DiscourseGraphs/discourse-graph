import React, { useEffect, useRef, useState } from "react";
import { Dialog, Classes, InputGroup, Label, Button } from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import createDiscourseNode from "~/utils/createDiscourseNode";
import { OnloadArgs } from "roamjs-components/types";
import updateBlock from "roamjs-components/writes/updateBlock";
import { render as renderToast } from "roamjs-components/components/Toast";
import getDiscourseNodes, {
  DiscourseNode,
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import { getNewDiscourseNodeText } from "~/utils/formatUtils";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import createBlock from "roamjs-components/writes/createBlock";

export type CreateNodeDialogProps = {
  onClose: () => void;
  defaultNodeTypeUid: string;
  extensionAPI: OnloadArgs["extensionAPI"];
  sourceBlockUid?: string;
  initialTitle: string;
};

const CreateNodeDialog = ({
  onClose,
  defaultNodeTypeUid,
  extensionAPI,
  sourceBlockUid,
  initialTitle,
}: CreateNodeDialogProps) => {
  const discourseNodes = getDiscourseNodes().filter(excludeDefaultNodes);
  const defaultNodeType =
    discourseNodes.find((n) => n.type === defaultNodeTypeUid) ||
    discourseNodes[0];

  const [title, setTitle] = useState(initialTitle);
  const [selectedType, setSelectedType] =
    useState<DiscourseNode>(defaultNodeType);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const onCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);

    const formattedTitle = await getNewDiscourseNodeText({
      text: title.trim(),
      nodeType: selectedType.type,
      blockUid: sourceBlockUid,
    });

    if (!formattedTitle) {
      setLoading(false);
      return;
    }

    const newPageUid = await createDiscourseNode({
      text: formattedTitle,
      configPageUid: selectedType.type,
      extensionAPI,
    });

    if (sourceBlockUid) {
      // TODO: This assumes the new node is always a page. If the specification
      // defines it as a block (e.g., "is in page with title"), this will not create
      // the correct reference. The reference format should be determined by the
      // node's specification.
      const pageRef = `[[${formattedTitle}]]`;
      await updateBlock({
        uid: sourceBlockUid,
        text: pageRef,
      });
      await createBlock({
        parentUid: sourceBlockUid,
        order: 0,
        node: {
          text: initialTitle,
        },
      });
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
            onClick={async (event) => {
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
            }}
          >
            [[{formattedTitle}]]
          </a>
        </span>
      ),
    });
    setLoading(false);
    
    // Remove focus from the block by simulating a click on the document
    // This changes the UI from block editing to not block editing
    document.body.click();
    
    onClose();
  };

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title="Create Discourse Node"
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

          <Label>
            Type
            <MenuItemSelect
              items={discourseNodes.map((n) => n.type)}
              transformItem={(t) =>
                discourseNodes.find((n) => n.type === t)?.text || t
              }
              activeItem={selectedType.type}
              onItemSelect={(t) => {
                const nt = discourseNodes.find((n) => n.type === t);
                if (nt) setSelectedType(nt);
              }}
            />
          </Label>
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

export const renderCreateNodeDialog = (props: CreateNodeDialogProps) =>
  renderOverlay({
    Overlay: CreateNodeDialog,
    props,
  });
