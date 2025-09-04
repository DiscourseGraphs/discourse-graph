import {
  createHTMLObserver,
  createButtonObserver,
  getPageTitleValueByHtmlElement,
} from "roamjs-components/dom";
import { createBlock } from "roamjs-components/writes";
import { renderLinkedReferenceAdditions } from "~/utils/renderLinkedReferenceAdditions";
import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import {
  renderTldrawCanvas,
  renderTldrawCanvasInSidebar,
} from "~/components/canvas/Tldraw";
import { renderQueryPage, renderQueryBlock } from "~/components/QueryBuilder";
import {
  DISCOURSE_CONFIG_PAGE_TITLE,
  renderNodeConfigPage,
} from "~/utils/renderNodeConfigPage";
import { isCurrentPageCanvas, isSidebarCanvas } from "~/utils/isCanvasPage";
import { isDiscourseNodeConfigPage as isNodeConfigPage } from "~/utils/isDiscourseNodeConfigPage";
import { isQueryPage } from "~/utils/isQueryPage";
import {
  enablePageRefObserver,
  addPageRefObserver,
  getPageRefObserversSize,
  previewPageRefHandler,
  overlayPageRefHandler,
} from "~/utils/pageRefObserverHandlers";
import getDiscourseNodes, { DiscourseNode } from "~/utils/getDiscourseNodes";
import { OnloadArgs } from "roamjs-components/types";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { render as renderGraphOverviewExport } from "~/components/ExportDiscourseContext";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { getSettingValueFromTree } from "roamjs-components/util";
import {
  getModifiersFromCombo,
  render as renderDiscourseNodeMenu,
} from "~/components/DiscourseNodeMenu";
import { IKeyCombo } from "@blueprintjs/core";
import { configPageTabs } from "~/utils/configPageTabs";
import { renderDiscourseNodeSearchMenu } from "~/components/DiscourseNodeSearchMenu";
import {
  renderTextSelectionPopup,
  removeTextSelectionPopup,
  findBlockElementFromSelection,
} from "~/utils/renderTextSelectionPopup";
import { renderNodeTagPopupButton } from "./renderNodeTagPopup";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";

let discourseNodes: DiscourseNode[] = [];
let discourseTagToStyle: Record<string, { color: string }> = {};

const refreshDiscourseNodeCache = () => {
  discourseNodes = getDiscourseNodes();
  discourseTagToStyle = discourseNodes.reduce(
    (acc, n) => {
      if (n.tag && n.canvasSettings?.color) {
        const color = formatHexColor(n.canvasSettings.color);
        acc[n.tag.toLowerCase()] = {
          color,
        };
      }
      return acc;
    },
    {} as Record<string, { color: string }>,
  );
};

const debounce = (fn: () => void, delay = 250) => {
  let timeout: number;
  return () => {
    clearTimeout(timeout);
    timeout = window.setTimeout(fn, delay);
  };
};

export const initObservers = async ({
  onloadArgs,
}: {
  onloadArgs: OnloadArgs;
}): Promise<{
  observers: MutationObserver[];
  listeners: {
    pageActionListener: EventListener;
    hashChangeListener: EventListener;
    nodeMenuTriggerListener: EventListener;
    discourseNodeSearchTriggerListener: EventListener;
    nodeCreationPopoverListener: EventListener;
  };
}> => {
  refreshDiscourseNodeCache();
  const pageTitleObserver = createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (e) => {
      const h1 = e as HTMLHeadingElement;
      const title = getPageTitleValueByHtmlElement(h1);
      const props = { title, h1, onloadArgs };

      if (isNodeConfigPage(title)) renderNodeConfigPage(props);
      else if (isQueryPage(props)) renderQueryPage(props);
      else if (isCurrentPageCanvas(props)) renderTldrawCanvas(props);
      else if (isSidebarCanvas(props)) renderTldrawCanvasInSidebar(props);
    },
  });

  // TODO: contains roam query: https://github.com/DiscourseGraphs/discourse-graph/issues/39
  const linkedReferencesObserver = createHTMLObserver({
    tag: "DIV",
    useBody: true,
    className: "rm-reference-main",
    callback: async (el) => {
      const div = el as HTMLDivElement;
      await renderLinkedReferenceAdditions(div, onloadArgs);
    },
  });

  const queryBlockObserver = createButtonObserver({
    attribute: "query-block",
    render: (b) => renderQueryBlock(b, onloadArgs),
  });

  const nodeTagPopupButtonObserver = createHTMLObserver({
    className: "rm-page-ref--tag",
    tag: "SPAN",
    callback: (s: HTMLSpanElement) => {
      const tag = s.getAttribute("data-tag");
      if (tag) {
        const style = discourseTagToStyle[tag.toLowerCase()];
        if (style) {
          renderNodeTagPopupButton(s, discourseNodes, onloadArgs.extensionAPI);
          s.style.color = style.color;
          s.style.padding = "2px 4px";
          s.style.borderRadius = "4px";
        }
      }
    },
  });

  const pageActionListener = ((
    e: CustomEvent<{
      action: string;
      uid: string;
      val: string;
      onRefresh: () => void;
    }>,
  ) => {
    if (!/page/i.test(e.detail.action)) return;
    window.roamAlphaAPI.ui.mainWindow
      .getOpenPageOrBlockUid()
      .then((u) => u || window.roamAlphaAPI.util.dateToPageUid(new Date()))
      .then((parentUid) => {
        createBlock({
          parentUid,
          order: Number.MAX_VALUE,
          node: { text: `[[${e.detail.val}]]` },
        });
      });
  }) as EventListener;

  const graphOverviewExportObserver = createHTMLObserver({
    tag: "DIV",
    className: "rm-graph-view-control-panel__main-options",
    callback: (el) => {
      const div = el as HTMLDivElement;
      renderGraphOverviewExport(div);
    },
  });

  if (onloadArgs.extensionAPI.settings.get("page-preview"))
    addPageRefObserver(previewPageRefHandler);
  if (onloadArgs.extensionAPI.settings.get("discourse-context-overlay")) {
    addPageRefObserver((s) => overlayPageRefHandler(s, onloadArgs));
  }
  if (!!getPageRefObserversSize()) enablePageRefObserver();

  const { pageUid: configPageUid, observer: configPageObserver } =
    await createConfigObserver({
      title: DISCOURSE_CONFIG_PAGE_TITLE,
      config: {
        tabs: configPageTabs(onloadArgs),
      },
    });
  // refresh config tree after config page is created
  refreshConfigTree();
  refreshDiscourseNodeCache();

  const hashChangeListener = (e: Event) => {
    const evt = e as HashChangeEvent;
    // Attempt to refresh config navigating away from config page
    // doesn't work if they update via sidebar
    if (
      evt.oldURL.endsWith(configPageUid) ||
      getDiscourseNodes().some(({ type }) => evt.oldURL.endsWith(type))
    ) {
      refreshConfigTree();
      refreshDiscourseNodeCache();
    }
  };

  const configTree = getBasicTreeByParentUid(configPageUid);
  const globalTrigger = getSettingValueFromTree({
    tree: configTree,
    key: "trigger",
    defaultValue: "\\",
  }).trim();
  const personalTriggerCombo =
    (onloadArgs.extensionAPI.settings.get(
      "personal-node-menu-trigger",
    ) as IKeyCombo) || undefined;
  const personalTrigger = personalTriggerCombo?.key;
  const personalModifiers = getModifiersFromCombo(personalTriggerCombo);
  const handleNodeMenuRender = (target: HTMLElement, evt: KeyboardEvent) => {
    if (
      target.tagName === "TEXTAREA" &&
      target.classList.contains("rm-block-input")
    ) {
      const textarea = target as HTMLTextAreaElement;
      removeTextSelectionPopup();
      renderDiscourseNodeMenu({
        textarea,
        extensionAPI: onloadArgs.extensionAPI,
        isShift: evt.shiftKey,
      });
      evt.preventDefault();
      evt.stopPropagation();
    }
  };

  const nodeMenuTriggerListener = (e: Event) => {
    const evt = e as KeyboardEvent;
    const target = evt.target as HTMLElement;

    // Personal Trigger overrides Global Trigger
    if (personalTrigger) {
      if (evt.key !== personalTrigger) return;
      if (
        (personalModifiers.includes("ctrl") && !evt.ctrlKey) ||
        (personalModifiers.includes("shift") && !evt.shiftKey) ||
        (personalModifiers.includes("alt") && !evt.altKey) ||
        (personalModifiers.includes("meta") && !evt.metaKey)
      ) {
        return;
      }
      handleNodeMenuRender(target, evt);
      return;
    }

    if (evt.key === globalTrigger) {
      handleNodeMenuRender(target, evt);
    }
  };

  const customTrigger = onloadArgs.extensionAPI.settings.get(
    "node-search-trigger",
  ) as string;

  const discourseNodeSearchTriggerListener = (e: Event) => {
    const evt = e as KeyboardEvent;
    const target = evt.target as HTMLElement;

    if (document.querySelector(".discourse-node-search-menu")) return;

    if (
      target.tagName === "TEXTAREA" &&
      target.classList.contains("rm-block-input")
    ) {
      const textarea = target as HTMLTextAreaElement;

      if (!customTrigger) return;

      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = textarea.value.substring(0, cursorPos);

      const lastTriggerPos = textBeforeCursor.lastIndexOf(customTrigger);

      if (lastTriggerPos >= 0) {
        const charBeforeTrigger =
          lastTriggerPos > 0
            ? textBeforeCursor.charAt(lastTriggerPos - 1)
            : null;

        const isValidTriggerPosition =
          lastTriggerPos === 0 ||
          charBeforeTrigger === " " ||
          charBeforeTrigger === "\n";

        const isCursorAfterTrigger =
          cursorPos === lastTriggerPos + customTrigger.length;

        if (isValidTriggerPosition && isCursorAfterTrigger) {
          // Double-check we have an active block context via Roam's API
          // This guards against edge cases where the DOM shows an input but Roam's internal state disagrees
          const isEditingBlock = !!window.roamAlphaAPI.ui.getFocusedBlock();
          if (!isEditingBlock) return;

          renderDiscourseNodeSearchMenu({
            onClose: () => {},
            textarea: textarea,
            triggerPosition: lastTriggerPos,
            triggerText: customTrigger,
          });
        }
      }
    }
  };

  const nodeCreationPopoverListener = debounce(() => {
    const isTextSelectionPopupEnabled =
      onloadArgs.extensionAPI.settings.get("text-selection-popup") !== false;

    if (!isTextSelectionPopupEnabled) return;

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || !selection.focusNode) {
      removeTextSelectionPopup();
      return;
    }

    const selectedText = selection.toString().trim();

    if (!selectedText) {
      removeTextSelectionPopup();
      return;
    }

    const blockElement = findBlockElementFromSelection();

    if (blockElement) {
      const textarea = blockElement.querySelector("textarea");
      if (!textarea) return;

      renderTextSelectionPopup({
        extensionAPI: onloadArgs.extensionAPI,
        blockElement,
        textarea,
      });
    } else {
      removeTextSelectionPopup();
    }
  }, 150);

  return {
    observers: [
      pageTitleObserver,
      queryBlockObserver,
      configPageObserver,
      linkedReferencesObserver,
      graphOverviewExportObserver,
      nodeTagPopupButtonObserver,
    ].filter((o): o is MutationObserver => !!o),
    listeners: {
      pageActionListener,
      hashChangeListener,
      nodeMenuTriggerListener,
      discourseNodeSearchTriggerListener,
      nodeCreationPopoverListener,
    },
  };
};
