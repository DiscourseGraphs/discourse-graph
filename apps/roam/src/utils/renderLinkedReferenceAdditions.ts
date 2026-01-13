import { createElement } from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import CanvasReferences from "~/components/canvas/CanvasReferences";
import { OnloadArgs } from "roamjs-components/types";
import DiscourseContextOverlay from "~/components/DiscourseContextOverlay";
import { handleTitleAdditions } from "./handleTitleAdditions";

export const renderDiscourseContext = ({
  h1,
  uid,
  tag,
}: {
  h1: HTMLHeadingElement;
  uid: string;
  tag: string;
}): void => {
  handleTitleAdditions(
    h1,
    createElement(DiscourseContextOverlay, { uid, tag }),
  );
};

export const renderCanvasReferences = (
  div: HTMLDivElement,
  uid: string,
  onloadArgs: OnloadArgs,
): void => {
  if (div.getAttribute("data-roamjs-discourse-context")) return;

  div.setAttribute("data-roamjs-discourse-context", "true");
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
