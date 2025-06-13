import React, { useState, useEffect, useRef } from "react";
import { Button, Menu, MenuItem, Popover, Position } from "@blueprintjs/core";
import getDiscourseNodes from "~/utils/getDiscourseNodes";

interface TextSelectionPopupProps {
  selectedText: string;
  selectionRect: DOMRect;
  onClose: () => void;
  onNodeTypeSelect: (nodeType: string, selectedText: string) => void;
}

export const TextSelectionPopup: React.FC<TextSelectionPopupProps> = ({
  selectedText,
  selectionRect,
  onClose,
  onNodeTypeSelect,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const discourseNodes = getDiscourseNodes();

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const nodeTypeMenu = (
    <Menu>
      {discourseNodes.map((node) => (
        <MenuItem
          key={node.type}
          text={node.type}
          icon={
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: node.canvasSettings.color || "#3182ce",
              }}
            />
          }
          onClick={() => {
            onNodeTypeSelect(node.type, selectedText);
            onClose();
          }}
        />
      ))}
    </Menu>
  );

  return (
    <div ref={popupRef}>
      <Popover
        content={nodeTypeMenu}
        position={Position.BOTTOM}
        isOpen={isDropdownOpen}
        onInteraction={(nextOpenState) => setIsDropdownOpen(nextOpenState)}
      >
        <Button
          minimal
          small
          icon={
            // Discourse Graph logo - using a simple graph icon for now
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="3" cy="3" r="2" />
              <circle cx="13" cy="3" r="2" />
              <circle cx="8" cy="13" r="2" />
              <line
                x1="5"
                y1="3"
                x2="11"
                y2="3"
                stroke="currentColor"
                strokeWidth="1"
              />
              <line
                x1="3"
                y1="5"
                x2="7"
                y2="11"
                stroke="currentColor"
                strokeWidth="1"
              />
              <line
                x1="13"
                y1="5"
                x2="9"
                y2="11"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          }
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          title="Add Discourse Node"
        />
      </Popover>
    </div>
  );
};
