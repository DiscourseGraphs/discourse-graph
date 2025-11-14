import { createRoot, type Root } from "react-dom/client";
import type { ReactElement } from "react";

const rootMap = new WeakMap<Element, Root>();

export const renderReactElement = (
  element: ReactElement,
  container: Element,
): void => {
  let root = rootMap.get(container);
  if (!root) {
    root = createRoot(container);
    rootMap.set(container, root);
  }
  root.render(element);
};

export const unmountReactRoot = (container: Element): void => {
  const root = rootMap.get(container);
  if (!root) return;
  root.unmount();
  rootMap.delete(container);
};
