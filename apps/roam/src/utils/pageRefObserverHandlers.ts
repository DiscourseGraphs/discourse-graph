import { createHTMLObserver } from "roamjs-components/dom";
import { render as previewRender } from "../components/LivePreview";
import isDiscourseNode from "./isDiscourseNode";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { render as discourseOverlayRender } from "../components/DiscourseContextOverlay";
import { OnloadArgs } from "roamjs-components/types";

const pageRefObservers = new Set<(s: HTMLSpanElement) => void>();
const pageRefObserverRef: { current?: MutationObserver } = {
  current: undefined,
};

export const overlayPageRefHandler = (s: HTMLSpanElement, args: OnloadArgs) => {
  if (s.parentElement && !s.parentElement.closest(".rm-page-ref")) {
    const tag =
      s.getAttribute("data-tag") ||
      s.parentElement.getAttribute("data-link-title");
    if (
      tag &&
      !s.getAttribute("data-roamjs-discourse-overlay") &&
      isDiscourseNode(getPageUidByPageTitle(tag))
    ) {
      s.setAttribute("data-roamjs-discourse-overlay", "true");
      const parent = document.createElement("span");
      discourseOverlayRender({
        parent,
        tag: tag.replace(/\\"/g, '"'),
        onloadArgs: args,
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

export const onPageRefObserverChange =
  (handler: (s: HTMLSpanElement) => void) => (b: boolean) => {
    if (b) {
      if (!pageRefObservers.size) enablePageRefObserver();
      pageRefObservers.add(handler);
    } else {
      pageRefObservers.delete(handler);
      if (!pageRefObservers.size) disablePageRefObserver();
    }
  };

export const addPageRefObserver = (handler: (s: HTMLSpanElement) => void) => {
  pageRefObservers.add(handler);
  if (pageRefObservers.size === 1) enablePageRefObserver();
};

export const removePageRefObserver = (
  handler: (s: HTMLSpanElement) => void,
) => {
  pageRefObservers.delete(handler);
  if (pageRefObservers.size === 0) disablePageRefObserver();
};

export const clearPageRefObservers = () => {
  disablePageRefObserver();
  pageRefObservers.clear();
};

export const getPageRefObserversSize = () => pageRefObservers.size;
