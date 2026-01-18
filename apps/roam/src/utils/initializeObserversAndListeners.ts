import {
  createHTMLObserver,
  createButtonObserver,
  getPageTitleValueByHtmlElement,
} from "roamjs-components/dom";
import { createBlock } from "roamjs-components/writes";
import { renderDiscourseContextAndCanvasReferences } from "~/utils/renderLinkedReferenceAdditions";
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
  getOverlayHandler,
  onPageRefObserverChange,
  getSuggestiveOverlayHandler,
} from "~/utils/pageRefObserverHandlers";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import { OnloadArgs } from "roamjs-components/types";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { render as renderGraphOverviewExport } from "~/components/ExportDiscourseContext";
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
import { renderImageToolsMenu } from "./renderImageToolsMenu";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { getSetting } from "./extensionSettings";
import { mountLeftSidebar, cacheOnloadArgs } from "~/components/LeftSidebarView";
import { getUidAndBooleanSetting } from "./getExportSettings";
import { getCleanTagText } from "~/components/settings/NodeConfig";
import {
  getFeatureFlag,
  getGlobalSetting,
} from "~/components/settings/utils/accessors";
import getPleasingColors from "@repo/utils/getPleasingColors";
import { colord } from "colord";
import { renderPossibleDuplicates } from "~/components/VectorDuplicateMatches";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import findDiscourseNode from "./findDiscourseNode";

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
  const pageTitleObserver = createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (e) => {
      const h1 = e as HTMLHeadingElement;
      const title = getPageTitleValueByHtmlElement(h1);
      const props = { title, h1, onloadArgs };

      const isSuggestiveModeEnabled = getFeatureFlag("Suggestive Mode Enabled");

      const uid = getPageUidByPageTitle(title);
      const node = findDiscourseNode({ uid, title });
      const isDiscourseNode = node && node.backedBy !== "default";
      if (isDiscourseNode) {
        if (isSuggestiveModeEnabled) {
          renderPossibleDuplicates(h1, title, node);
        }
        const linkedReferencesDiv = document.querySelector(
          ".rm-reference-main",
        ) as HTMLDivElement;
        if (linkedReferencesDiv) {
          renderDiscourseContextAndCanvasReferences(
            linkedReferencesDiv,
            uid,
            onloadArgs,
          );
        }
      }

      if (isNodeConfigPage(title)) renderNodeConfigPage(props);
      else if (isQueryPage(props)) renderQueryPage(props);
      else if (isCurrentPageCanvas(props)) renderTldrawCanvas(props);
      else if (isSidebarCanvas(props)) renderTldrawCanvasInSidebar(props);
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
        const normalizedTag = getCleanTagText(tag);

        for (const node of getDiscourseNodes()) {
          const normalizedNodeTag = node.tag ? getCleanTagText(node.tag) : "";
          if (normalizedTag === normalizedNodeTag) {
            renderNodeTagPopupButton(s, node, onloadArgs.extensionAPI);
            if (node.canvasSettings?.color) {
              const formattedColor = formatHexColor(node.canvasSettings.color);
              if (!formattedColor) {
                break;
              }
              const contrastingColor = getPleasingColors(
                colord(formattedColor),
              );

              Object.assign(s.style, {
                backgroundColor: contrastingColor.background,
                color: contrastingColor.text,
                border: `1px solid ${contrastingColor.border}`,
                fontWeight: "500",
                padding: "2px 6px",
                borderRadius: "12px",
                margin: "0 2px",
                fontSize: "0.9em",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                display: "inline-block",
                cursor: "pointer",
              });
            }
            break;
          }
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

  if (onloadArgs.extensionAPI.settings.get("suggestive-mode-overlay")) {
    addPageRefObserver(getSuggestiveOverlayHandler(onloadArgs));
  }

  const graphOverviewExportObserver = createHTMLObserver({
    tag: "DIV",
    className: "rm-graph-view-control-panel__main-options",
    callback: (el) => {
      const div = el as HTMLDivElement;
      renderGraphOverviewExport(div);
    },
  });

  const imageMenuObserver = createHTMLObserver({
    tag: "IMG",
    className: "rm-inline-img",
    callback: (img: HTMLElement) => {
      if (img instanceof HTMLImageElement) {
        renderImageToolsMenu(img, onloadArgs.extensionAPI);
      }
    },
  });

  if (onloadArgs.extensionAPI.settings.get("page-preview"))
    addPageRefObserver(previewPageRefHandler);
  if (onloadArgs.extensionAPI.settings.get("discourse-context-overlay")) {
    const overlayHandler = getOverlayHandler(onloadArgs);
    onPageRefObserverChange(overlayHandler)(true);
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

  const hashChangeListener = (e: Event) => {
    const evt = e as HashChangeEvent;
    // Attempt to refresh config navigating away from config page
    // doesn't work if they update via sidebar
    if (
      evt.oldURL.endsWith(configPageUid) ||
      getDiscourseNodes().some(({ type }) => evt.oldURL.endsWith(type))
    ) {
      refreshConfigTree();
    }
  };

  const globalTrigger = (
    getGlobalSetting<string>(["Trigger"]) || "\\"
  ).trim();
  const personalTriggerCombo =
    (onloadArgs.extensionAPI.settings.get(
      "personal-node-menu-trigger",
    ) as IKeyCombo) || undefined;
  const personalTrigger = personalTriggerCombo?.key;
  const personalModifiers = getModifiersFromCombo(personalTriggerCombo);

  const leftSidebarObserver = createHTMLObserver({
    tag: "DIV",
    useBody: true,
    className: "starred-pages-wrapper",
    callback: (el) => {
      void (async () => {
        cacheOnloadArgs(onloadArgs);

        const isLeftSidebarEnabled = getFeatureFlag("Enable Left Sidebar");
        const container = el as HTMLDivElement;
        if (isLeftSidebarEnabled) {
          container.style.padding = "0";
          await mountLeftSidebar(container, onloadArgs);
        }
      })();
    },
  });

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

  const customTrigger = getSetting("node-search-trigger", "@");

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
      graphOverviewExportObserver,
      nodeTagPopupButtonObserver,
      leftSidebarObserver,
      imageMenuObserver,
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
