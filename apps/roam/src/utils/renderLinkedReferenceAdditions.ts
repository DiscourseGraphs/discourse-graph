import { createElement } from "react";
import { getPageTitleValueByHtmlElement } from "roamjs-components/dom";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import { DiscourseContext } from "~/components";
import CanvasReferences from "~/components/canvas/CanvasReferences";
import isDiscourseNode from "./isDiscourseNode";
import { OnloadArgs } from "roamjs-components/types";

export const renderLinkedReferenceAdditions = async (
  div: HTMLDivElement,
  onloadArgs: OnloadArgs,
) => {
  const isMainWindow = !!div.closest(".roam-article");
  const uid = isMainWindow
    ? await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid()
    : getPageUidByPageTitle(getPageTitleValueByHtmlElement(div));
  if (
    uid &&
    isDiscourseNode(uid) &&
    !div.getAttribute("data-roamjs-discourse-context")
  ) {
    div.setAttribute("data-roamjs-discourse-context", "true");
    const parent = div.firstElementChild;
    if (parent) {
      const insertBefore = parent.firstElementChild;

      const p = document.createElement("div");
      parent.insertBefore(p, insertBefore);
      renderWithUnmount(
        createElement(DiscourseContext, {
          uid,
          results: [],
        }),
        p,
        onloadArgs,
      );

      const canvasP = document.createElement("div");
      parent.insertBefore(canvasP, insertBefore);
      renderWithUnmount(
        createElement(CanvasReferences, {
          uid,
        }),
        canvasP,
        onloadArgs,
      );
    }
  }
};
