import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { Button, Popover, Position } from "@blueprintjs/core";
import { renderCreateNodeDialog } from "~/components/CreateNodeDialog";
import { OnloadArgs } from "roamjs-components/types";
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getDiscourseNodes from "./getDiscourseNodes";

const TableEmbedPopup: React.FC<{
  parent: HTMLElement;
  matchedNode: any;
  extensionAPI: OnloadArgs["extensionAPI"];
  blockUid?: string;
  cleanedBlockText: string;
}> = ({ parent, matchedNode, extensionAPI, blockUid, cleanedBlockText }) => {
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const popupRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const rect = parent.getBoundingClientRect();
    setPopupPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
    setShowPopup(true);
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && popupRef.current?.contains(relatedTarget)) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      setShowPopup(false);
    }, 150);
  };

  const handlePopupMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handlePopupMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowPopup(false);
    }, 100);
  };

  useEffect(() => {
    parent.addEventListener("mouseenter", handleMouseEnter);
    parent.addEventListener("mouseleave", handleMouseLeave);
    parent.style.cursor = "pointer";

    return () => {
      parent.removeEventListener("mouseenter", handleMouseEnter);
      parent.removeEventListener("mouseleave", handleMouseLeave);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!showPopup) return null;

  return ReactDOM.createPortal(
    <div
      ref={popupRef}
      onMouseEnter={handlePopupMouseEnter}
      onMouseLeave={handlePopupMouseLeave}
      style={{
        position: "fixed",
        left: `${popupPosition.x}px`,
        top: `${popupPosition.y}px`,
        transform: "translate(-50%, -100%)",
        zIndex: 10000,
        background: "white",
        border: "1px solid rgba(16, 22, 26, 0.2)",
        borderRadius: "3px",
        padding: "4px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
      }}
    >
      <Button
        minimal
        outlined
        small
        onClick={() => {
          renderCreateNodeDialog({
            onClose: () => {},
            defaultNodeTypeUid: matchedNode.type,
            extensionAPI,
            sourceBlockUid: blockUid,
            initialTitle: cleanedBlockText,
          });
          setShowPopup(false);
        }}
        text={`Create ${matchedNode.text}`}
      />
    </div>,
    document.body,
  );
};

export const renderNodeTagPopupButton = (
  parent: HTMLSpanElement,
  discourseNodes: DiscourseNode[],
  extensionAPI: OnloadArgs["extensionAPI"],
) => {
  if (parent.dataset.attributeButtonRendered === "true") {
    return;
  }

  parent.dataset.attributeButtonRendered = "true";

  const isInTable = !!parent.closest("td.relative");
  const isInEmbed = !!parent.closest(".roamjs-query-embed");

  const textContent = parent.textContent?.trim() || "";
  const tagAttr = parent.getAttribute("data-tag") || textContent;
  const tag = tagAttr.replace(/^#/, "").toLowerCase();
  const discourseNodes = getDiscourseNodes();
  const discourseTagSet = new Set(
    discourseNodes.map((n) => n.tag?.toLowerCase()).filter(Boolean),
  );

  if (!discourseTagSet.has(tag)) {
    return;
  }

  const matchedNode = discourseNodes.find((n) => n.tag?.toLowerCase() === tag);
  if (!matchedNode) {
    return;
  }

  const blockInputElement = parent.closest(".rm-block__input");
  const blockUid = blockInputElement
    ? getUids(blockInputElement as HTMLDivElement).blockUid
    : undefined;

  const rawBlockText = blockUid ? getTextByBlockUid(blockUid) : "";
  const cleanedBlockText = rawBlockText.replace(textContent, "").trim();

  if (isInTable && isInEmbed) {
    const reactContainer = document.createElement("div");
    reactContainer.style.display = "none";
    parent.appendChild(reactContainer);

    ReactDOM.render(
      <TableEmbedPopup
        parent={parent}
        matchedNode={matchedNode}
        extensionAPI={extensionAPI}
        blockUid={blockUid}
        cleanedBlockText={cleanedBlockText}
      />,
      reactContainer,
    );
  } else {
    const wrapper = document.createElement("span");
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block";
    parent.parentNode?.insertBefore(wrapper, parent);
    wrapper.appendChild(parent);

    const reactRoot = document.createElement("span");
    reactRoot.style.position = "absolute";
    reactRoot.style.top = "0";
    reactRoot.style.left = "0";
    reactRoot.style.width = "100%";
    reactRoot.style.height = "100%";
    reactRoot.style.pointerEvents = "none";
    reactRoot.style.zIndex = "10";
    wrapper.appendChild(reactRoot);

    ReactDOM.render(
      <Popover
        content={
          <Button
            minimal
            outlined
            onClick={() => {
              renderCreateNodeDialog({
                onClose: () => {},
                defaultNodeTypeUid: matchedNode.type,
                extensionAPI,
                sourceBlockUid: blockUid,
                initialTitle: cleanedBlockText,
              });
            }}
            text={`Create ${matchedNode.text}`}
          />
        }
        target={
          <span
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              pointerEvents: "auto",
            }}
          />
        }
        interactionKind="hover"
        usePortal={true}
        portalClassName="dg-popover"
        position={Position.TOP}
        modifiers={{
          offset: {
            offset: "0, 10",
          },
          arrow: {
            enabled: false,
          },
        }}
      />,
      reactRoot,
    );
  }
};
