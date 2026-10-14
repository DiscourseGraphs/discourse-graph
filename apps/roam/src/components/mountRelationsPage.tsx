import React from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import { getUidsFromId } from "roamjs-components/dom";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import getBlockProps, { isJsonObject } from "~/utils/getBlockProps";
import RelationsPage from "./RelationsPage";

export const initRelationsPages = (): {
  mount: (args: {
    heading: HTMLElement;
    title: string;
    pageUid: string;
  }) => void;
  unmount: (heading: HTMLElement) => void;
  dispose: () => void;
} => {
  const mounts = new Map<HTMLElement, () => void>();
  const mount = ({
    heading,
    title,
    pageUid,
  }: {
    heading: HTMLElement;
    title: string;
    pageUid: string;
  }): void => {
    if (mounts.has(heading)) return;
    // The stored page uses singular "graph"; also recognize the plural spelling.
    if (!/^roam\/js\/discourse-graphs?\/relations$/.test(title)) return;
    const root = heading.closest(".roam-article, .rm-sidebar-outline");
    const titleContainer =
      heading.closest(".rm-title-display-container") || heading.parentElement;
    if (!root || !titleContainer || !pageUid) return;
    const host = document.createElement("div");
    host.className = "dg-relations-host";
    titleContainer.after(host);
    let relationUids = new Set<string>();
    const hidden = new Set<HTMLElement>();
    let uiVisible = true;
    let concealNewBlocks = true;
    const hideBlock = (block: HTMLElement): void => {
      if (!uiVisible || host.contains(block)) return;
      const container = block.closest<HTMLElement>(".roam-block-container");
      if (!container || hidden.has(container)) return;
      const uid = getUidsFromId(block.id).blockUid;
      if (!uid) return;
      const isRelation =
        relationUids.has(uid) ||
        (concealNewBlocks &&
          getParentUidByBlockUid(uid) === pageUid &&
          isJsonObject(getBlockProps(uid)["discourse-graph"]));
      if (!isRelation) return;
      container.classList.add("dg-relation-storage-block");
      hidden.add(container);
    };
    const hideAddedBlocks = (node: Node): void => {
      if (!(node instanceof HTMLElement) || host.contains(node)) return;
      if (node.matches(".roam-block[id]")) hideBlock(node);
      node.querySelectorAll<HTMLElement>(".roam-block[id]").forEach(hideBlock);
    };
    const restoreBlocks = (): void => {
      hidden.forEach((block) =>
        block.classList.remove("dg-relation-storage-block"),
      );
      hidden.clear();
    };
    const onVisibilityChange = (visible: boolean): void => {
      uiVisible = visible;
      restoreBlocks();
      root.querySelectorAll<HTMLElement>(".roam-block[id]").forEach(hideBlock);
    };
    const onRowsLoaded = (uids: string[] | null): void => {
      restoreBlocks();
      relationUids = new Set(uids || []);
      // An empty successful load must still conceal the first relation added later.
      // On a failed load, restore storage so it remains accessible for recovery.
      concealNewBlocks = uids !== null;
      root.querySelectorAll<HTMLElement>(".roam-block[id]").forEach(hideBlock);
    };
    const blocksObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (host.contains(mutation.target)) return;
        mutation.addedNodes.forEach(hideAddedBlocks);
      });
    });
    blocksObserver.observe(root, { childList: true, subtree: true });
    const unmount = renderWithUnmount(
      <RelationsPage
        pageUid={pageUid}
        onRowsLoaded={onRowsLoaded}
        onVisibilityChange={onVisibilityChange}
      />,
      host,
    );
    mounts.set(heading, () => {
      blocksObserver.disconnect();
      restoreBlocks();
      unmount();
      host.remove();
      mounts.delete(heading);
    });
  };
  return {
    mount,
    unmount: (heading) => mounts.get(heading)?.(),
    dispose: () => mounts.forEach((unmount) => unmount()),
  };
};
