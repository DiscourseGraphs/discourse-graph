import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { Button, Popover, Position } from "@blueprintjs/core";

let currentPopup: HTMLDivElement | null = null;

export const removeNodeTagPopup = () => {
  if (currentPopup) {
    ReactDOM.unmountComponentAtNode(currentPopup);
    currentPopup.remove();
    currentPopup = null;
  }
};

const HoverControlledPopover = ({
  onClick,
  label,
  onClose,
  tagElement,
}: {
  onClick: () => void;
  label: string;
  onClose: () => void;
  tagElement: HTMLElement;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<number>();

  useEffect(() => {
    const handleMouseEnter = () => {
      clearTimeout(timeoutRef.current);
      setIsOpen(true);
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget?.closest(".discourse-node-tag-portal")) {
        return;
      }

      timeoutRef.current = window.setTimeout(() => {
        setIsOpen(false);
        setTimeout(onClose, 100);
      }, 150);
    };

    tagElement.addEventListener("mouseenter", handleMouseEnter);
    tagElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      tagElement.removeEventListener("mouseenter", handleMouseEnter);
      tagElement.removeEventListener("mouseleave", handleMouseLeave);
      clearTimeout(timeoutRef.current);
    };
  }, [tagElement, onClose]);

  const handlePopoverMouseEnter = () => {
    clearTimeout(timeoutRef.current);
  };

  const handlePopoverMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setTimeout(onClose, 100);
    }, 150);
  };

  const rect = tagElement.getBoundingClientRect();

  return (
    <Popover
      content={
        <div
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
        >
          <Button intent="primary" outlined onClick={onClick} text={label} />
        </div>
      }
      target={
        <div
          style={{
            position: "fixed",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            pointerEvents: "none",
          }}
        />
      }
      isOpen={isOpen}
      position={Position.TOP}
      minimal
      usePortal={true}
      modifiers={{
        preventOverflow: { enabled: true },
        flip: { enabled: true },
        offset: { enabled: true, offset: "0, 18" },
      }}
      portalClassName="discourse-node-tag-portal"
    />
  );
};

export const renderNodeTagPopup = ({
  tagElement,
  onClick,
  label = "Create node",
}: {
  tagElement: HTMLElement;
  onClick: () => void;
  label?: string;
}) => {
  removeNodeTagPopup();

  const rect = tagElement.getBoundingClientRect();

  currentPopup = document.createElement("div");
  currentPopup.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.left}px;
    pointer-events: none;
    z-index: 999;
  `;

  document.body.appendChild(currentPopup);

  ReactDOM.render(
    <HoverControlledPopover
      onClick={onClick}
      label={label}
      onClose={removeNodeTagPopup}
      tagElement={tagElement}
    />,
    currentPopup,
  );
};
