import React from "react";
import { createRoot, Root } from "react-dom/client";

/**
 * A mapping of container elements to their React roots
 * This helps with proper cleanup when components unmount
 */
const containerRoots = new WeakMap<HTMLElement, Root>();

/**
 * Renders a React component inside a container element and manages cleanup
 *
 * @param container The HTML element to render the React component in
 * @param component The React component to render
 */
export function renderReactComponent(
  container: HTMLElement,
  component: React.ReactNode,
): void {
  // Check if this container already has a React root
  let root = containerRoots.get(container);

  if (!root) {
    // If no root exists, create one and store it
    root = createRoot(container);
    containerRoots.set(container, root);

    // Add a mutation observer to detect when the container is removed from the DOM
    // This ensures we clean up the React root when the container is removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (
            node === container ||
            (node instanceof Element && node.contains(container))
          ) {
            // Container was removed, unmount the React root and remove it from our map
            root?.unmount();
            containerRoots.delete(container);
            observer.disconnect();
          }
        });
      });
    });

    // Start observing the document body for changes
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Render the component
  root.render(component);
}
