import nanoid from "nanoid";
import { createElement } from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import CanvasReferences from "~/components/canvas/CanvasReferences";
import { OnloadArgs } from "roamjs-components/types";
import { DiscourseContextCollapseOverlay } from "~/components/DiscourseContextOverlay";
import { handleTitleAdditions } from "./handleTitleAdditions";

export const renderDiscourseContext = ({
  h1,
  uid,
}: {
  h1: HTMLHeadingElement;
  uid: string;
}): void => {
  if (h1.getAttribute("data-roamjs-top-discourse-context")) return;
  handleTitleAdditions(
    h1,
    createElement(DiscourseContextCollapseOverlay, {
      uid,
      id: nanoid(),
    }),
  );
  h1.setAttribute("data-roamjs-top-discourse-context", "true");
};

export const renderCanvasReferences = (
  div: HTMLDivElement,
  uid: string,
  onloadArgs: OnloadArgs,
): void => {
  if (div.getAttribute("data-roamjs-canvas-reference")) return;

  div.setAttribute("data-roamjs-canvas-reference", "true");
  const parent = div.firstElementChild;
  if (!parent) return;

  const insertBefore = parent.firstElementChild;

  const canvasP = document.createElement("div");
  parent.insertBefore(canvasP, insertBefore);
  renderWithUnmount(
    createElement(CanvasReferences, {
      uid,
    }),
    canvasP,
    onloadArgs,
  );
};
