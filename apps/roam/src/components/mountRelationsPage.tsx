import React from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import {
  createHTMLObserver,
  getPageTitleValueByHtmlElement,
  getUidsFromId,
} from "roamjs-components/dom";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import RelationsPage from "./RelationsPage";

export const initRelationsPages = (): (() => void) => {
  const mounts = new Map<HTMLElement, () => void>();
  const observer = createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (heading) => {
      if (mounts.has(heading)) return;
      const title = getPageTitleValueByHtmlElement(heading);
      // The stored page uses singular "graph"; also recognize the plural spelling.
      if (!/^roam\/js\/discourse-graphs?\/relations$/.test(title)) return;
      const root = heading.closest(".roam-article, .rm-sidebar-outline");
      const titleContainer =
        heading.closest(".rm-title-display-container") || heading.parentElement;
      const pageUid = getPageUidByPageTitle(title);
      if (!root || !titleContainer || !pageUid) return;
      const host = document.createElement("div");
      host.className = "dg-relations-host";
      titleContainer.after(host);
      let relationUids = new Set<string>();
      const hidden = new Set<HTMLElement>();
      const hideStorageBlocks = (): void => {
        root
          .querySelectorAll<HTMLElement>(".roam-block[id]")
          .forEach((block) => {
            const container = block.closest<HTMLElement>(
              ".roam-block-container",
            );
            if (
              !container ||
              !relationUids.has(getUidsFromId(block.id).blockUid)
            )
              return;
            container.classList.add("dg-relation-storage-block");
            hidden.add(container);
          });
      };
      const onRowsLoaded = (uids: string[]): void => {
        hidden.forEach((block) =>
          block.classList.remove("dg-relation-storage-block"),
        );
        hidden.clear();
        relationUids = new Set(uids);
        hideStorageBlocks();
      };
      const blocksObserver = new MutationObserver(hideStorageBlocks);
      blocksObserver.observe(root, { childList: true, subtree: true });
      const unmount = renderWithUnmount(
        <RelationsPage pageUid={pageUid} onRowsLoaded={onRowsLoaded} />,
        host,
      );
      mounts.set(heading, () => {
        blocksObserver.disconnect();
        hidden.forEach((block) =>
          block.classList.remove("dg-relation-storage-block"),
        );
        unmount();
        host.remove();
        mounts.delete(heading);
      });
    },
    removeCallback: (heading) => mounts.get(heading)?.(),
  });
  return () => {
    observer?.disconnect();
    mounts.forEach((unmount) => unmount());
  };
};
