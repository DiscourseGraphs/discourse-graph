import { createHTMLObserver } from "roamjs-components/dom";
import { render as previewRender } from "~/components/LivePreview";
import isDiscourseNode from "./isDiscourseNode";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { render as discourseOverlayRender } from "~/components/DiscourseContextOverlay";
import { OnloadArgs } from "roamjs-components/types";
import { renderSuggestive as renderSuggestiveOverlay } from "~/components/SuggestiveModeOverlay";

const pageRefObservers = new Set<(s: HTMLSpanElement) => void>();
const pageRefObserverRef: { current?: MutationObserver } = {
  current: undefined,
};

// Public handler (stable reference)
let cachedHandler: ((s: HTMLSpanElement) => void) | undefined;
export const getOverlayHandler = (onloadArgs: OnloadArgs) =>
  cachedHandler ||
  (cachedHandler = (s: HTMLSpanElement) =>
    overlayPageRefHandler(s, onloadArgs));

let cachedSuggestiveHandler: ((s: HTMLSpanElement) => void) | undefined;
export const getSuggestiveOverlayHandler = (onloadArgs: OnloadArgs) =>
  cachedSuggestiveHandler ||
  (cachedSuggestiveHandler = (s: HTMLSpanElement) =>
    suggestiveOverlayPageRefHandler(s, onloadArgs));

export const overlayPageRefHandler = (
  s: HTMLSpanElement,
  onloadArgs: OnloadArgs,
) => {
  if (s.parentElement && !s.parentElement.closest(".rm-page-ref")) {
    if (
      s.closest(".rm-title-display, .rm-title-display-container") ||
      s.parentElement?.closest(".rm-title-display, .rm-title-display-container")
    ) {
      return;
    }
    const tag =
      s.getAttribute("data-tag") ||
      s.parentElement.getAttribute("data-link-title");
    const hasOverlayAttribute = s.getAttribute("data-roamjs-discourse-overlay");
    const hasOverlayElement =
      (s.hasAttribute("data-tag") &&
        Array.from(s.children).some(
          (child) =>
            child instanceof HTMLSpanElement &&
            child.querySelector(".roamjs-discourse-context-overlay"),
        )) ||
      (s.parentElement &&
        Array.from(s.parentElement.children).some(
          (child) =>
            child instanceof HTMLSpanElement &&
            child.querySelector(".roamjs-discourse-context-overlay"),
        ));
    if (
      tag &&
      !hasOverlayAttribute &&
      !hasOverlayElement &&
      isDiscourseNode(getPageUidByPageTitle(tag))
    ) {
      s.setAttribute("data-roamjs-discourse-overlay", "true");
      const parent = document.createElement("span");
      discourseOverlayRender({
        parent,
        tag: tag.replace(/\\"/g, '"'),
        onloadArgs,
      });
      if (s.hasAttribute("data-tag")) {
        s.appendChild(parent);
      } else {
        s.parentElement.appendChild(parent);
      }
    }
  }
};

export const suggestiveOverlayPageRefHandler = (
  s: HTMLSpanElement,
  onloadArgs: OnloadArgs,
) => {
  if (s.parentElement && !s.parentElement.closest(".rm-page-ref")) {
    const tag =
      s.getAttribute("data-tag") ||
      s.parentElement.getAttribute("data-link-title");
    if (
      tag &&
      !s.getAttribute("data-discourse-suggestive-overlay") &&
      isDiscourseNode(getPageUidByPageTitle(tag))
    ) {
      s.setAttribute("data-discourse-suggestive-overlay", "true");
      const parent = document.createElement("span");
      renderSuggestiveOverlay({
        parent,
        tag: tag.replace(/\\"/g, '"'),
        onloadArgs,
      });
      if (s.hasAttribute("data-tag")) {
        s.appendChild(parent);
      } else {
        s.parentElement.appendChild(parent);
      }
    }
  }
};

export const previewPageRefHandler = (s: HTMLSpanElement) => {
  const tag =
    s.getAttribute("data-tag") ||
    s.parentElement?.getAttribute("data-link-title");
  if (tag && !s.getAttribute("data-roamjs-discourse-augment-tag")) {
    s.setAttribute("data-roamjs-discourse-augment-tag", "true");
    const parent = document.createElement("span");
    previewRender({
      parent,
      tag,
      registerMouseEvents: ({ open, close }) => {
        s.addEventListener("mouseenter", (e) => open(e.ctrlKey));
        s.addEventListener("mouseleave", close);
      },
    });
    s.appendChild(parent);
  }
};

export const enablePageRefObserver = () =>
  (pageRefObserverRef.current = createHTMLObserver({
    useBody: true,
    tag: "SPAN",
    className: "rm-page-ref",
    callback: (s: HTMLSpanElement) => {
      pageRefObservers.forEach((f) => f(s));
    },
  }));

const disablePageRefObserver = () => {
  pageRefObserverRef.current?.disconnect();
  pageRefObserverRef.current = undefined;
};

const applyHandlersToExistingPageRefs = (
  handler: (s: HTMLSpanElement) => void,
) => {
  const existingPageRefs =
    document.querySelectorAll<HTMLSpanElement>("span.rm-page-ref");
  existingPageRefs.forEach((pageRef) => {
    handler(pageRef);
  });
};

const removeOverlayElements = (
  pageRefSelector: string,
  overlayClass: string,
  attributeName: string,
) => {
  const allPageRefs =
    document.querySelectorAll<HTMLSpanElement>(pageRefSelector);
  allPageRefs.forEach((pageRef) => {
    const directChildContainer = Array.from(pageRef.children).find(
      (child) =>
        child instanceof HTMLSpanElement &&
        child.querySelector(`.${overlayClass}`),
    ) as HTMLSpanElement | undefined;
    if (directChildContainer) {
      directChildContainer.remove();
      pageRef.removeAttribute(attributeName);
      return;
    }

    if (pageRef.parentElement) {
      const parentDirectChildContainer = Array.from(
        pageRef.parentElement.children,
      ).find(
        (child) =>
          child instanceof HTMLSpanElement &&
          child.querySelector(`.${overlayClass}`),
      ) as HTMLSpanElement | undefined;
      if (parentDirectChildContainer) {
        parentDirectChildContainer.remove();
        pageRef.removeAttribute(attributeName);
      }
    }
  });
};

// Queries all page refs (not just attributed ones) to catch cases where attribute is missing
const removeOverlaysFromExistingPageRefs = () =>
  removeOverlayElements(
    "span.rm-page-ref",
    "roamjs-discourse-context-overlay",
    "data-roamjs-discourse-overlay",
  );

const removeSuggestiveOverlaysFromExistingPageRefs = () =>
  removeOverlayElements(
    "span.rm-page-ref[data-discourse-suggestive-overlay]",
    "suggestive-mode-overlay",
    "data-discourse-suggestive-overlay",
  );

export const onPageRefObserverChange =
  (handler: (s: HTMLSpanElement) => void) => (b: boolean) => {
    if (b) {
      if (!pageRefObservers.size) enablePageRefObserver();
      pageRefObservers.add(handler);
      // Apply handler to existing page refs when enabling
      applyHandlersToExistingPageRefs(handler);
    } else {
      pageRefObservers.delete(handler);
      // Remove overlays from existing page refs when disabling
      if (handler === cachedHandler) {
        removeOverlaysFromExistingPageRefs();
      }
      if (handler === cachedSuggestiveHandler) {
        removeSuggestiveOverlaysFromExistingPageRefs();
      }
      if (!pageRefObservers.size) disablePageRefObserver();
    }
  };

export const addPageRefObserver = (handler: (s: HTMLSpanElement) => void) => {
  pageRefObservers.add(handler);
};

export const getPageRefObserversSize = () => pageRefObservers.size;
