import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Menu, MenuItem, Popover, Position } from "@blueprintjs/core";
import ReactDOM from "react-dom";
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import posthog from "posthog-js";
import { OnloadArgs } from "roamjs-components/types/native";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";

type Props = {
  textarea: HTMLTextAreaElement;
  extensionAPI: OnloadArgs["extensionAPI"];
};

type DiscourseType = {
  type: string;
  title: string;
  items: { id: string; text: string }[];
};

// Hardcoded discourse types for testing
// TODO: replace with actual discourse types
const DISCOURSE_TYPES: DiscourseType[] = [
  {
    type: "claims",
    title: "Claims",
    items: [
      { id: "clm1", text: "[[CLM]] - Claim 1" },
      { id: "clm2", text: "[[CLM]] - Claim 1" },
    ],
  },
  {
    type: "evidence",
    title: "Evidence",
    items: [
      { id: "evd1", text: "[[EVD]] - Evidence 1" },
      { id: "evd2", text: "[[EVD]] - Evidence 2" },
    ],
  },
  {
    type: "results",
    title: "Results",
    items: [
      { id: "res1", text: "[[RES]] - Result 1" },
      { id: "res2", text: "[[RES]] - Result 1" },
    ],
  },
];

const NodeSearchMenu = ({
  onClose,
  textarea,
  extensionAPI,
}: { onClose: () => void } & Props) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const blockUid = useMemo(() => getUids(textarea).blockUid, [textarea]);

  const handleTextAreaInput = useCallback(() => {
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf("@");

    if (lastAtPos !== -1) {
      const newSearchTerm = textBeforeCursor.substring(lastAtPos + 1);
      setSearchTerm(newSearchTerm);
    }
  }, [textarea]);

  useEffect(() => {
    textarea.addEventListener("input", handleTextAreaInput);
    return () => {
      textarea.removeEventListener("input", handleTextAreaInput);
    };
  }, [handleTextAreaInput, textarea]);

  const filteredTypes = useMemo(() => {
    if (!searchTerm.trim()) return DISCOURSE_TYPES;

    return DISCOURSE_TYPES.map((type) => ({
      ...type,
      items: type.items.filter((item) =>
        item.text.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    })).filter((type) => type.items.length > 0);
  }, [searchTerm]);

  const allItems = useMemo(() => {
    const items: {
      typeIndex: number;
      itemIndex: number;
      item: { id: string; text: string };
    }[] = [];

    filteredTypes.forEach((type, typeIndex) => {
      type.items.forEach((item, itemIndex) => {
        items.push({ typeIndex, itemIndex, item });
      });
    });

    return items;
  }, [filteredTypes]);

  const onSelect = useCallback(
    (item: { id: string; text: string }) => {
      setTimeout(() => {
        const currentBlockText = getTextByBlockUid(blockUid);
        const atSymbolPos = textarea.value.lastIndexOf("@");
        // TODO: replace with actual search results
        const pageRef = `[[${item.text}]]`;
        const newText = `${currentBlockText.substring(0, atSymbolPos)}${pageRef}${currentBlockText.substring(atSymbolPos + searchTerm.length + 1)}`;

        updateBlock({ text: newText, uid: blockUid });
        posthog.capture("Discourse Node: Selected from Search Menu", {
          id: item.id,
          text: item.text,
        });
      });
      onClose();
    },
    [blockUid, onClose, searchTerm],
  );

  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        setActiveIndex((prev) => (prev + 1) % allItems.length);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setActiveIndex(
          (prev) => (prev - 1 + allItems.length) % allItems.length,
        );
        e.preventDefault();
      } else if (e.key === "Enter") {
        if (allItems.length > 0) {
          onSelect(allItems[activeIndex].item);
        }
        e.preventDefault();
      } else if (e.key === "Escape") {
        onClose();
        e.preventDefault();
      }
    },
    [allItems, activeIndex, onSelect, onClose],
  );

  useEffect(() => {
    if (activeIndex >= allItems.length) {
      setActiveIndex(0);
    }
  }, [allItems, activeIndex]);

  useEffect(() => {
    document.addEventListener("keydown", keydownListener);
    return () => {
      document.removeEventListener("keydown", keydownListener);
    };
  }, [keydownListener]);

  useEffect(() => {
    handleTextAreaInput();
  }, [handleTextAreaInput]);

  let currentGlobalIndex = -1;

  return (
    <Popover
      onClose={onClose}
      isOpen={true}
      canEscapeKeyClose
      minimal
      target={<span />}
      position={Position.BOTTOM_LEFT}
      modifiers={{
        flip: { enabled: true },
        preventOverflow: { enabled: true },
      }}
      autoFocus={false}
      enforceFocus={false}
      content={
        <div className="discourse-node-search-menu" style={{ width: "250px" }}>
          <div className="discourse-node-menu-content max-h-80 overflow-y-auto">
            {filteredTypes.map((type, typeIndex) => (
              <div key={type.type} className="mb-2">
                <div className="border-b border-gray-200 px-3 py-1 text-sm font-semibold text-gray-500">
                  {type.title}
                </div>
                <Menu>
                  {type.items.map((item, itemIndex) => {
                    currentGlobalIndex++;
                    const isActive = currentGlobalIndex === activeIndex;
                    return (
                      <MenuItem
                        key={item.id}
                        text={item.text}
                        active={isActive}
                        onMouseEnter={() => setActiveIndex(currentGlobalIndex)}
                        onClick={() => onSelect(item)}
                      />
                    );
                  })}
                </Menu>
              </div>
            ))}

            {allItems.length === 0 && (
              <div className="p-3 text-center text-gray-500">
                No matches found
              </div>
            )}
          </div>
        </div>
      }
    />
  );
};

export const renderDiscourseNodeSearchMenu = (props: Props) => {
  const parent = document.createElement("span");
  const coords = getCoordsFromTextarea(props.textarea);
  parent.style.position = "absolute";
  parent.style.left = `${coords.left}px`;
  parent.style.top = `${coords.top}px`;
  props.textarea.parentElement?.insertBefore(parent, props.textarea);

  ReactDOM.render(
    <NodeSearchMenu
      {...props}
      onClose={() => {
        ReactDOM.unmountComponentAtNode(parent);
        parent.remove();
      }}
    />,
    parent,
  );
};
