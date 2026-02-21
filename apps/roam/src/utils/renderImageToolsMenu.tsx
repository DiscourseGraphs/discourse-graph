import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom";
import { Button, IconName } from "@blueprintjs/core";
import getUids from "roamjs-components/dom/getUids";
import NodeMenu from "~/components/DiscourseNodeMenu";
import { OnloadArgs } from "roamjs-components/types";
import posthog from "posthog-js";

type ImageToolsMenuProps = {
  blockUid: string;
  extensionAPI: OnloadArgs["extensionAPI"];
};

const ImageToolsMenu = ({
  blockUid,
  extensionAPI,
}: ImageToolsMenuProps): JSX.Element => {
  const [menuKey, setMenuKey] = useState(0);

  const handleEditBlock = useCallback((): void => {
    posthog.capture("Image Tools Menu: Edit Block Clicked");
    // eslint-disable-next-line @typescript-eslint/naming-convention
    void window.roamAlphaAPI.ui.setBlockFocusAndSelection({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      location: { "block-uid": blockUid, "window-id": "main-window" },
    });
  }, [blockUid]);

  const handleMenuClose = useCallback(() => {
    setMenuKey((prev) => prev + 1);
  }, []);

  const trigger = (
    <Button icon={"label" as IconName} minimal small title="Add Node Tag" />
  );

  return (
    <div
      className="flex gap-1 rounded border border-gray-200 bg-white p-1 shadow-sm"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <NodeMenu
        key={menuKey}
        onClose={handleMenuClose}
        blockUid={blockUid}
        extensionAPI={extensionAPI}
        trigger={trigger}
        isShift={false}
      />

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

const isMenuAlreadyRendered = (wrapper: HTMLElement): boolean => {
  return wrapper.getAttribute("data-image-menu-rendered") === "true";
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

type WrapperWithCleanup = HTMLElement & {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __imageMenuCleanup?: () => void;
};

const attachHoverListeners = (
  wrapper: HTMLElement,
  menuContainer: HTMLDivElement,
): void => {
  const handleMouseEnter = () => {
    menuContainer.classList.remove("hidden");
    menuContainer.classList.add("block");
  };
  const handleMouseLeave = () => {
    menuContainer.classList.remove("block");
    menuContainer.classList.add("hidden");
  };

  wrapper.addEventListener("mouseenter", handleMouseEnter);
  wrapper.addEventListener("mouseleave", handleMouseLeave);

  // Store cleanup function
  (wrapper as WrapperWithCleanup).__imageMenuCleanup = () => {
    wrapper.removeEventListener("mouseenter", handleMouseEnter);
    wrapper.removeEventListener("mouseleave", handleMouseLeave);
  };
};

export const renderImageToolsMenu = (
  imageElement: HTMLImageElement,
  extensionAPI: OnloadArgs["extensionAPI"],
): void => {
  const wrapper = getImageWrapper(imageElement);
  if (!wrapper) return;

  if (isMenuAlreadyRendered(wrapper)) return;

  const blockUid = getBlockUidFromImage(imageElement);
  if (!blockUid) return;

  setupWrapperForMenu(wrapper);

  const menuContainer = createMenuContainer();
  wrapper.appendChild(menuContainer);
  attachHoverListeners(wrapper, menuContainer);

  // eslint-disable-next-line react/no-deprecated
  ReactDOM.render(
    <ImageToolsMenu blockUid={blockUid} extensionAPI={extensionAPI} />,
    menuContainer,
  );
};
