import React from "react";
import ReactDOM from "react-dom";
import { Button, Popover, Position } from "@blueprintjs/core";
import { OnloadArgs, PullBlock } from "roamjs-components/types";
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { type DiscourseNode } from "./getDiscourseNodes";
import { renderModifyNodeDialog } from "~/components/ModifyNodeDialog";
import { getReferencedNodeInFormat } from "./formatUtils";
import discourseNodeFormatToDatalog from "./discourseNodeFormatToDatalog";
import compileDatalog from "./compileDatalog";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";

export const renderNodeTagPopupButton = (
  parent: HTMLSpanElement,
  matchedNode: DiscourseNode,
  extensionAPI: OnloadArgs["extensionAPI"],
) => {
  if (parent.dataset.attributeButtonRendered === "true") return;

  const rect = parent.getBoundingClientRect();
  parent.dataset.attributeButtonRendered = "true";
  const wrapper = document.createElement("span");
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";
  parent.parentNode?.insertBefore(wrapper, parent);
  wrapper.appendChild(parent);

  const reactRoot = document.createElement("span");
  reactRoot.style.position = "absolute";
  reactRoot.style.top = "0";
  reactRoot.style.left = "0";
  reactRoot.style.width = `${rect.width}px`;
  reactRoot.style.height = `${rect.height}px`;
  reactRoot.style.pointerEvents = "none";
  reactRoot.style.zIndex = "10";

  wrapper.appendChild(reactRoot);

  const textContent = parent.textContent?.trim() || "";
  const blockInputElement = parent.closest(".rm-block__input");
  const blockUid = blockInputElement
    ? getUids(blockInputElement as HTMLDivElement).blockUid
    : undefined;

  const rawBlockText = blockUid ? getTextByBlockUid(blockUid) : "";
  const cleanedBlockText = rawBlockText.replace(textContent, "").trim();

  const getInitialReferencedNode = async () => {
    if (!blockUid) return { text: "", uid: "" };

    const referencedNodeType = getReferencedNodeInFormat({
      format: matchedNode.format,
    });

    if (!referencedNodeType) return { text: "", uid: "" };

    try {
      const referenced = (
        await window.roamAlphaAPI.data.async.fast.q(
          `[:find (pull ?r [:node/title :block/string]) :where [?b :block/uid "${blockUid}"] (or-join [?b ?r] (and [?b :block/parents ?p] [?p :block/refs ?r]) (and [?b :block/page ?r])) ${discourseNodeFormatToDatalog(
            {
              freeVar: "r",
              ...referencedNodeType,
            },
          )
            .map((c) => compileDatalog(c, 0))
            .join(" ")}]`,
        )
      )?.[0]?.[0] as PullBlock;

      if (referenced) {
        const title =
          referenced[":node/title"] || referenced[":block/string"] || "";
        if (title) {
          const uid = getPageUidByPageTitle(title);
          return { text: title, uid: uid };
        }
      }
    } catch (error) {
      console.error("Error getting initial referenced node:", error);
    }

    return { text: "", uid: "" };
  };

  const handleClick = async () => {
    const initialReferencedNode = await getInitialReferencedNode();
    renderModifyNodeDialog({
      mode: "create",
      nodeType: matchedNode.type,
      initialValue: { text: cleanedBlockText, uid: "" },
      initialReferencedNode,
      onSuccess: async () => {
        // Success is handled by the dialog itself
      },
      onClose: () => {},
      sourceBlockUid: blockUid,
      extensionAPI,
    });
  };

  ReactDOM.render(
    <Popover
      content={
        <Button
          minimal
          outlined
          onClick={() => void handleClick()}
          text={`Create ${matchedNode.text}`}
        />
      }
      target={
        <span
          style={{
            display: "block",
            top: "0",
            left: "0",
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            position: "absolute",
            pointerEvents: "auto",
          }}
        />
      }
      interactionKind="hover"
      position={Position.TOP}
      modifiers={{
        offset: {
          offset: `${rect.width / 2}px, 10`,
        },
        arrow: {
          enabled: false,
        },
      }}
    />,
    reactRoot,
  );
};
