import React, { useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  Button,
  Menu,
  MenuItem,
  Popover,
  Position,
  IconName,
} from "@blueprintjs/core";
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import getDiscourseNodes from "./getDiscourseNodes";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";

type ImageToolsMenuProps = {
  onClose: () => void;
  blockUid: string;
};

const ImageToolsMenu = ({
  onClose,
  blockUid,
}: ImageToolsMenuProps): JSX.Element => {
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  const userDiscourseNodes = useMemo(
    () => getDiscourseNodes().filter((n) => n.backedBy === "user"),
    [],
  );

  const discourseNodes = userDiscourseNodes.filter((n) => n.tag);

  const handleAddTag = useCallback(
    async (tag: string): Promise<void> => {
      setIsPopoverOpen(false);
      const currentText = getTextByBlockUid(blockUid);
      const cleanTag = tag.replace(/^#/, "");
      const textToInsert = ` #${cleanTag}`;
      await updateBlock({ text: currentText + textToInsert, uid: blockUid });
      onClose();
    },
    [blockUid, onClose],
  );

  const handleEditBlock = useCallback((): void => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    void window.roamAlphaAPI.ui.setBlockFocusAndSelection({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      location: { "block-uid": blockUid, "window-id": "main-window" },
    });
    onClose();
  }, [blockUid, onClose]);

  return (
    <div
      className="flex gap-1 rounded border border-gray-200 bg-white p-1 shadow-sm"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Popover
        content={
          <Menu>
            {discourseNodes.map((item) => {
              const nodeColor =
                formatHexColor(item?.canvasSettings?.color) || "#000";
              return (
                <MenuItem
                  key={item.text}
                  text={item.text}
                  icon={
                    <div
                      className="mr-2 h-4 w-4 select-none rounded-full"
                      style={{
                        backgroundColor: nodeColor,
                        border: "none",
                        outline: "none",
                      }}
                    />
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleAddTag(item.tag || "");
                  }}
                />
              );
            })}
          </Menu>
        }
        position={Position.BOTTOM}
        interactionKind="click"
        isOpen={isPopoverOpen}
        onInteraction={(nextOpenState) => setIsPopoverOpen(nextOpenState)}
      >
        <Button icon={"label" as IconName} minimal small title="Add Node Tag" />
      </Popover>

      <Button
        icon={"edit" as IconName}
        minimal
        small
        title="Edit Block"
        onClick={(e) => {
          e.stopPropagation();
          handleEditBlock();
        }}
      />
    </div>
  );
};

const isMenuAlreadyRendered = (imageElement: HTMLImageElement): boolean => {
  return (
    imageElement.parentElement?.getAttribute("data-image-menu-rendered") ===
    "true"
  );
};

const getBlockUidFromImage = (
  imageElement: HTMLImageElement,
): string | undefined => {
  const blockInputElement = imageElement.closest(".rm-block__input");
  return blockInputElement
    ? getUids(blockInputElement as HTMLDivElement).blockUid
    : undefined;
};

const getImageWrapper = (
  imageElement: HTMLImageElement,
): HTMLElement | null => {
  return (
    (imageElement.closest(".rm-inline-img__resize") as HTMLElement) ||
    (imageElement.closest(".rm-inline-img") as HTMLElement) ||
    imageElement.parentElement
  );
};

const setupWrapperForMenu = (wrapper: HTMLElement): void => {
  wrapper.setAttribute("data-image-menu-rendered", "true");
  wrapper.classList.add("relative");
};

const createMenuContainer = (): HTMLDivElement => {
  const menuContainer = document.createElement("div");
  menuContainer.className = "absolute bottom-1 right-1 z-[100] hidden";
  return menuContainer;
};

const attachHoverListeners = (
  wrapper: HTMLElement,
  menuContainer: HTMLDivElement,
): void => {
  wrapper.addEventListener("mouseenter", () => {
    menuContainer.classList.remove("hidden");
    menuContainer.classList.add("block");
  });
  wrapper.addEventListener("mouseleave", () => {
    menuContainer.classList.remove("block");
    menuContainer.classList.add("hidden");
  });
};


export const renderImageToolsMenu = (imageElement: HTMLImageElement): void => {
  if (isMenuAlreadyRendered(imageElement)) return;

  const blockUid = getBlockUidFromImage(imageElement);
  if (!blockUid) return;

  const wrapper = getImageWrapper(imageElement);
  if (!wrapper) return;

  setupWrapperForMenu(wrapper);

  const menuContainer = createMenuContainer();
  wrapper.appendChild(menuContainer);
  attachHoverListeners(wrapper, menuContainer);

  // eslint-disable-next-line react/no-deprecated
  ReactDOM.render(
    <ImageToolsMenu onClose={() => {}} blockUid={blockUid} />,
    menuContainer,
  );
};
