import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Menu,
  MenuItem,
  Popover,
  Position,
  Icon,
} from "@blueprintjs/core";
import NodeMenu from "./DiscourseNodeMenu";
import { OnloadArgs } from "roamjs-components/types";

interface TextSelectionPopupProps {
  selectedText: string;
  selectionRect: DOMRect;
  onClose: () => void;
  onNodeTypeSelect: (nodeType: string, selectedText: string) => void;
  discourseNodes: Array<{
    type: string;
    text: string;
    canvasSettings: { color?: string };
  }>;
  extensionAPI: OnloadArgs["extensionAPI"];
  textarea: HTMLTextAreaElement;
}

export const TextSelectionPopup: React.FC<TextSelectionPopupProps> = ({
  selectedText,
  selectionRect,
  onClose,
  onNodeTypeSelect,
  discourseNodes,
  extensionAPI,
  textarea,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

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
    <NodeMenu
      textarea={textarea}
      extensionAPI={extensionAPI}
      onClose={onClose}
    />
  );

  // const nodeTypeMenu = (
  //   <Menu>
  //     {discourseNodes.map((node) => (
  //       <MenuItem
  //         key={node.type}
  //         text={node.text}
  //         icon={
  //           <div
  //             style={{
  //               width: 12,
  //               height: 12,
  //               borderRadius: "50%",
  //               backgroundColor: node.canvasSettings.color || "#3182ce",
  //             }}
  //           />
  //         }
  //         onClick={() => {
  //           onNodeTypeSelect(node.type, selectedText);
  //           onClose();
  //         }}
  //       />
  //     ))}
  //   </Menu>
  // );

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
            <div className="flex items-center gap-1">
              <svg
                width="18"
                height="19"
                viewBox="0 0 18 19"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M11.0389 17.7527C9.91285 18.8786 8.08718 18.8786 6.96115 17.7527L0.844529 11.6361C-0.281509 10.51 -0.28151 8.68435 0.844528 7.55832L3.90284 4.50001C4.46586 3.93698 5.37868 3.93698 5.94171 4.50001C6.50473 5.06302 6.50473 5.97585 5.94171 6.53888L4.92228 7.55832C3.79623 8.68435 3.79623 10.51 4.92228 11.6361L7.98057 14.6944C8.5436 15.2574 9.45643 15.2574 10.0194 14.6944C10.5825 14.1313 10.5825 13.2185 10.0194 12.6555L9.00001 11.6361C7.87398 10.51 7.87398 8.68435 9.00001 7.55832C10.1261 6.43227 10.1261 4.6066 9.00001 3.48057L7.98057 2.46114C7.41756 1.89812 7.41756 0.985283 7.98057 0.422263C8.5436 -0.140755 9.45643 -0.140754 10.0194 0.422265L17.1555 7.55832C18.2815 8.68435 18.2815 10.51 17.1555 11.6361L11.0389 17.7527ZM14.0972 8.57776C13.5342 8.01473 12.6213 8.01473 12.0583 8.57776C11.4953 9.14077 11.4953 10.0536 12.0583 10.6166C12.6213 11.1796 13.5342 11.1796 14.0972 10.6166C14.6602 10.0536 14.6602 9.14077 14.0972 8.57776Z"
                  fill="#555555"
                />
              </svg>
              <Icon icon="chevron-down" size={16} color="#555555" />
            </div>
          }
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsDropdownOpen(!isDropdownOpen);
          }}
          title="Add Discourse Node"
        />
      </Popover>
    </div>
  );
};
