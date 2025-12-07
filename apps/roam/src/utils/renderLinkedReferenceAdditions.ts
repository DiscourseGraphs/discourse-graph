import { createElement } from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import { DiscourseContext } from "~/components";
import CanvasReferences from "~/components/canvas/CanvasReferences";
import { OnloadArgs } from "roamjs-components/types";

export const renderDiscourseContextAndCanvasReferences = (
  div: HTMLDivElement,
  uid: string,
  onloadArgs: OnloadArgs,
): void => {
  if (div.getAttribute("data-roamjs-discourse-context")) return;

  div.setAttribute("data-roamjs-discourse-context", "true");
  const parent = div.firstElementChild;
  if (!parent) return;

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
};
