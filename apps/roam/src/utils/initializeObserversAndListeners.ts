import {
  createHTMLObserver,
  createButtonObserver,
  getPageTitleValueByHtmlElement,
} from "roamjs-components/dom";
import { createBlock } from "roamjs-components/writes";
import {
  renderCanvasReferences,
  renderDiscourseContext,
} from "~/utils/renderLinkedReferenceAdditions";
import {
  renderTldrawCanvas,
  renderTldrawCanvasInSidebar,
} from "~/components/canvas/Tldraw";
import { renderQueryPage, renderQueryBlock } from "~/components/QueryBuilder";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/data/constants";
import { isCurrentPageCanvas, isSidebarCanvas } from "~/utils/isCanvasPage";
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
import getDiscourseNodes, {
  type DiscourseNode,
} from "~/utils/getDiscourseNodes";
import { OnloadArgs } from "roamjs-components/types";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { render as renderGraphOverviewExport } from "~/components/ExportDiscourseContext";
import {
  getModifiersFromCombo,
  render as renderDiscourseNodeMenu,
} from "~/components/DiscourseNodeMenu";
import { IKeyCombo } from "@blueprintjs/core";
import { renderDiscourseNodeSearchMenu } from "~/components/DiscourseNodeSearchMenu";
import {
  renderTextSelectionPopup,
  removeTextSelectionPopup,
  findBlockElementFromSelection,
} from "~/utils/renderTextSelectionPopup";
import { renderNodeTagPopupButton } from "./renderNodeTagPopup";
import { renderImageToolsMenu } from "./renderImageToolsMenu";
import { mountLeftSidebar } from "~/components/LeftSidebarView";
import { getFeatureFlag } from "~/components/settings/utils/accessors";
import { getCleanTagText } from "~/components/settings/NodeConfig";
import { getNodeTagStyles } from "~/utils/getDiscourseNodeColors";
import { renderPossibleDuplicates } from "~/components/VectorDuplicateMatches";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import findDiscourseNode from "./findDiscourseNode";
import {
  bulkReadSettings,
  type SettingsSnapshot,
} from "~/components/settings/utils/accessors";
import {
  onSettingChange,
  settingKeys,
} from "~/components/settings/utils/settingsEmitter";
import {
  PERSONAL_KEYS,
  GLOBAL_KEYS,
} from "~/components/settings/utils/settingKeys";

const debounce = (fn: () => void, delay = 250) => {
  let timeout: number;
  return () => {
    clearTimeout(timeout);
    timeout = window.setTimeout(fn, delay);
  };
};

const getTitleAndUidFromHeader = (h1: HTMLHeadingElement) => {
  const titleDisplayContainer = h1.closest(".rm-title-display-container");
  const dataUid = titleDisplayContainer?.getAttribute("data-page-uid") || "";
  if (dataUid) {
    const titleByUid = getPageTitleByPageUid(dataUid) || "";
    return { title: titleByUid, uid: dataUid };
  }

  const title = getPageTitleValueByHtmlElement(h1);
  const uid = getPageUidByPageTitle(title);
  return { title, uid };
};

export const initObservers = ({
  onloadArgs,
  settings,
}: {
  onloadArgs: OnloadArgs;
  settings: SettingsSnapshot;
}): {
  observers: MutationObserver[];
  listeners: {
    pageActionListener: EventListener;
    hashChangeListener: EventListener;
    nodeMenuTriggerListener: EventListener;
    discourseNodeSearchTriggerListener: EventListener;
    nodeCreationPopoverListener: EventListener;
  };
  cleanups: Array<() => void>;
} => {
  let _t = performance.now();
  const _op = (label: string) => {
    const now = performance.now();
    console.log(`[DG Load initObservers] ${label}: ${Math.round(now - _t)}ms`);
    _t = now;
  };

  let _ptCount = 0;
  const pageTitleObserver = createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (e) => {
      _ptCount++;
      const _cs = performance.now();
      const _cl = (l: string) => {
        const n = performance.now();
        console.log(
          `[DG Load ptCb #${_ptCount}] ${l}: ${Math.round(n - _cs)}ms`,
        );
      };

      const h1 = e as HTMLHeadingElement;
      const { title, uid } = getTitleAndUidFromHeader(h1);
      _cl(`getTitleAndUid ("${title.slice(0, 30)}")`);

      const settings = bulkReadSettings();
      _cl("bulkReadSettings");

      const props = { title, h1, onloadArgs };

      const node = findDiscourseNode({
        uid,
        title,
        snapshot: settings,
      });
      _cl("findDiscourseNode");

      const isDiscourseNode = node && node.backedBy !== "default";
      if (isDiscourseNode) {
        renderDiscourseContext({ h1, uid });
        _cl("renderDiscourseContext");
        if (getFeatureFlag("Duplicate node alert enabled")) {
          renderPossibleDuplicates(h1, title, node);
          _cl("renderPossibleDuplicates");
        }
        const linkedReferencesDiv = document.querySelector(
          ".rm-reference-main",
        ) as HTMLDivElement;
        if (linkedReferencesDiv) {
          renderCanvasReferences(linkedReferencesDiv, uid, onloadArgs);
          _cl("renderCanvasReferences");
        }
      }
      if (isQueryPage({ title, snapshot: settings })) {
        renderQueryPage(props);
        _cl("renderQueryPage");
      } else if (isCurrentPageCanvas({ title, h1, snapshot: settings })) {
        renderTldrawCanvas(props);
        _cl("renderTldrawCanvas");
      } else if (isSidebarCanvas({ title, h1, snapshot: settings })) {
        renderTldrawCanvasInSidebar(props);
        _cl("renderTldrawCanvasInSidebar");
      }
      _cl("TOTAL");
    },
  });
  _op("pageTitleObserver");

  let _qbCount = 0;
  const queryBlockObserver = createButtonObserver({
    attribute: "query-block",
    render: (b) => {
      _qbCount++;
      const _qs = performance.now();
      renderQueryBlock(b, onloadArgs);
      console.log(
        `[DG Load qbCb #${_qbCount}] renderQueryBlock: ${Math.round(performance.now() - _qs)}ms`,
      );
    },
  });
  _op("queryBlockObserver");

  let batchedTagNodes: DiscourseNode[] | null = null;
  let _tagCbCount = 0;
  const getNodesForTagBatch = (): DiscourseNode[] => {
    if (batchedTagNodes === null) {
      const _bt = performance.now();
      const settings = bulkReadSettings();
      console.log(
        `[DG Load tagCb] bulkReadSettings: ${Math.round(performance.now() - _bt)}ms`,
      );
      const _bt2 = performance.now();
      batchedTagNodes = getDiscourseNodes(undefined, settings);
      console.log(
        `[DG Load tagCb] getDiscourseNodes: ${Math.round(performance.now() - _bt2)}ms`,
      );
      queueMicrotask(() => {
        batchedTagNodes = null;
      });
    }
    return batchedTagNodes;
  };

  const nodeTagPopupButtonObserver = createHTMLObserver({
    className: "rm-page-ref--tag",
    tag: "SPAN",
    callback: (s: HTMLSpanElement) => {
      _tagCbCount++;
      const _tcStart = performance.now();
      const tag = s.getAttribute("data-tag");
      if (tag) {
        const normalizedTag = getCleanTagText(tag);

        for (const node of getNodesForTagBatch()) {
          const normalizedNodeTag = node.tag ? getCleanTagText(node.tag) : "";
          if (normalizedTag === normalizedNodeTag) {
            renderNodeTagPopupButton(s, node, onloadArgs.extensionAPI);
            const color = node.canvasSettings?.color ?? "";
            const tagStyles = color ? getNodeTagStyles(color) : {};
            if (tagStyles) {
              Object.assign(s.style, tagStyles);
            }
            break;
          }
        }
      }
      console.log(
        `[DG Load tagCb #${_tagCbCount}] tag="${tag}" total: ${Math.round(performance.now() - _tcStart)}ms`,
      );
    },
  });
  _op("nodeTagPopupButtonObserver");

  const pageActionListener = ((
    e: CustomEvent<{
      action: string;
      uid: string;
      val: string;
      onRefresh: () => void;
    }>,
  ) => {
    if (!/page/i.test(e.detail.action)) return;
    void window.roamAlphaAPI.ui.mainWindow
      .getOpenPageOrBlockUid()
      .then((u) => u || window.roamAlphaAPI.util.dateToPageUid(new Date()))
      .then((parentUid) => {
        return createBlock({
          parentUid,
          order: Number.MAX_VALUE,
          node: { text: `[[${e.detail.val}]]` },
        });
      });
  }) as EventListener;
  _op("pageActionListener");

  if (getFeatureFlag("Suggestive mode overlay enabled")) {
    addPageRefObserver(getSuggestiveOverlayHandler(onloadArgs));
  }
  _op("suggestiveOverlay check");

  let _goCount = 0;
  const graphOverviewExportObserver = createHTMLObserver({
    tag: "DIV",
    className: "rm-graph-view-control-panel__main-options",
    callback: (el) => {
      _goCount++;
      const _gs = performance.now();
      const div = el as HTMLDivElement;
      renderGraphOverviewExport(div);
      console.log(
        `[DG Load goCb #${_goCount}] renderGraphOverviewExport: ${Math.round(performance.now() - _gs)}ms`,
      );
    },
  });
  _op("graphOverviewExportObserver");

  let _imCount = 0;
  const imageMenuObserver = createHTMLObserver({
    tag: "IMG",
    className: "rm-inline-img",
    callback: (img: HTMLElement) => {
      _imCount++;
      const _is = performance.now();
      if (img instanceof HTMLImageElement) {
        renderImageToolsMenu(img, onloadArgs.extensionAPI);
      }
      console.log(
        `[DG Load imCb #${_imCount}] renderImageToolsMenu: ${Math.round(performance.now() - _is)}ms`,
      );
    },
  });
  _op("imageMenuObserver");

  if (settings.personalSettings[PERSONAL_KEYS.pagePreview])
    addPageRefObserver(previewPageRefHandler);
  _op("pagePreview check");

  if (settings.personalSettings[PERSONAL_KEYS.discourseContextOverlay]) {
    const overlayHandler = getOverlayHandler(onloadArgs);
    onPageRefObserverChange(overlayHandler)(true);
  }
  _op("discourseContextOverlay check");

  if (getPageRefObserversSize()) enablePageRefObserver();
  _op("enablePageRefObserver");

  const configPageUid = getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE);
  _op("getPageUidByPageTitle(config)");

  const hashChangeListener = (e: Event) => {
    const evt = e as HashChangeEvent;
    const settings = bulkReadSettings();
    // Attempt to refresh config navigating away from config page
    // doesn't work if they update via sidebar
    if (
      (configPageUid && evt.oldURL.endsWith(configPageUid)) ||
      getDiscourseNodes(undefined, settings).some(({ type }) =>
        evt.oldURL.endsWith(type),
      )
    ) {
      refreshConfigTree(settings);
    }
  };
  _op("hashChangeListener");

  let globalTrigger = settings.globalSettings[GLOBAL_KEYS.trigger].trim();
  const personalTriggerComboRaw =
    settings.personalSettings[PERSONAL_KEYS.personalNodeMenuTrigger];
  const personalTriggerCombo =
    typeof personalTriggerComboRaw === "object"
      ? personalTriggerComboRaw
      : undefined;
  let personalTrigger = personalTriggerCombo?.key;
  let personalModifiers = personalTriggerCombo
    ? getModifiersFromCombo(personalTriggerCombo)
    : [];
  _op("trigger setup");

  const unsubGlobalTrigger = onSettingChange(
    settingKeys.globalTrigger,
    (newValue) => {
      globalTrigger = (newValue as string).trim();
    },
  );
  _op("onSettingChange(globalTrigger)");

  const unsubPersonalTrigger = onSettingChange(
    settingKeys.personalNodeMenuTrigger,
    (newValue) => {
      const combo =
        newValue && typeof newValue === "object"
          ? (newValue as IKeyCombo)
          : undefined;
      personalTrigger = combo?.key;
      personalModifiers = combo ? getModifiersFromCombo(combo) : [];
    },
  );
  _op("onSettingChange(personalNodeMenuTrigger)");

  let _lsCount = 0;
  const leftSidebarObserver = createHTMLObserver({
    tag: "DIV",
    useBody: true,
    className: "starred-pages-wrapper",
    callback: (el) => {
      _lsCount++;
      const _lsN = _lsCount;
      void (async () => {
        const _ls = performance.now();
        const settings = bulkReadSettings();
        console.log(
          `[DG Load lsCb #${_lsN}] bulkReadSettings: ${Math.round(performance.now() - _ls)}ms`,
        );
        const isLeftSidebarEnabled =
          settings.featureFlags["Enable left sidebar"];
        const container = el as HTMLDivElement;
        if (isLeftSidebarEnabled) {
          container.style.padding = "0";
          const _lm = performance.now();
          await mountLeftSidebar({
            wrapper: container,
            onloadArgs,
            initialSnapshot: settings,
          });
          console.log(
            `[DG Load lsCb #${_lsN}] mountLeftSidebar: ${Math.round(performance.now() - _lm)}ms`,
          );
        }
        console.log(
          `[DG Load lsCb #${_lsN}] TOTAL: ${Math.round(performance.now() - _ls)}ms`,
        );
      })();
    },
  });
  _op("leftSidebarObserver");

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

  let customTrigger =
    settings.personalSettings[PERSONAL_KEYS.nodeSearchMenuTrigger];

  const unsubSearchTrigger = onSettingChange(
    settingKeys.nodeSearchMenuTrigger,
    (newValue) => {
      customTrigger = newValue as string;
    },
  );
  _op("onSettingChange(nodeSearchMenuTrigger)");

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
    const settings = bulkReadSettings();
    if (!settings.personalSettings[PERSONAL_KEYS.textSelectionPopup]) return;

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
    cleanups: [unsubGlobalTrigger, unsubPersonalTrigger, unsubSearchTrigger],
  };
};
