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
import { renderCanvasEmbed } from "~/components/canvas/CanvasEmbed";
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
import {
  withAsyncPerformanceTrace,
  withPerformanceTrace,
} from "./performanceLogger";

const debounce = (fn: () => void, delay = 250) => {
  let timeout: number;
  return () => {
    clearTimeout(timeout);
    timeout = window.setTimeout(fn, delay);
  };
};

const compactTraceContent = (content?: string | null): string | undefined => {
  const compacted = content?.replace(/\s+/g, " ").trim();
  return compacted ? compacted.slice(0, 120) : undefined;
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
  const pageTitleObserver = createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (e) => {
      let titleLength = 0;
      let isDiscourseNode = false;
      let isQuery = false;
      let isCanvas = false;
      let isSidebar = false;
      let renderedCanvasReferences = false;
      let content: string | undefined;

      withPerformanceTrace(
        {
          label: "observer:pageTitle",
          thresholdMs: 16,
          aggregateThresholdMs: 50,
          details: () => ({
            titleLength,
            isDiscourseNode,
            isQuery,
            isCanvas,
            isSidebar,
            renderedCanvasReferences,
            content,
          }),
        },
        () => {
          const h1 = e as HTMLHeadingElement;
          const { title, uid } = getTitleAndUidFromHeader(h1);
          titleLength = title.length;
          content = compactTraceContent(title);

          const settings = bulkReadSettings({
            source: "observer:pageTitle",
            content,
          });

          const props = { title, h1, onloadArgs };

          const node = findDiscourseNode({
            uid,
            title,
            snapshot: settings,
            trace: {
              source: "observer:pageTitle:findDiscourseNode",
              content,
            },
          });

          isDiscourseNode = !!node && node.backedBy !== "default";
          if (isDiscourseNode && node) {
            renderDiscourseContext({ h1, uid });
            if (
              getFeatureFlag("Duplicate node alert enabled", {
                source: "observer:pageTitle:duplicateAlert",
                content,
              })
            ) {
              renderPossibleDuplicates(h1, title, node);
            }
            const linkedReferencesDiv = document.querySelector(
              ".rm-reference-main",
            ) as HTMLDivElement;
            if (linkedReferencesDiv) {
              renderCanvasReferences(linkedReferencesDiv, uid, onloadArgs);
              renderedCanvasReferences = true;
            }
          }

          isQuery = isQueryPage({ title, snapshot: settings });
          if (isQuery) {
            renderQueryPage(props);
            return;
          }

          isCanvas = isCurrentPageCanvas({ title, h1, snapshot: settings });
          if (isCanvas) {
            renderTldrawCanvas(props);
            return;
          }

          isSidebar = isSidebarCanvas({ title, h1, snapshot: settings });
          if (isSidebar) {
            renderTldrawCanvasInSidebar(props);
          }
        },
      );
    },
  });

  const queryBlockObserver = createButtonObserver({
    attribute: "query-block",
    render: (b) => {
      const content = compactTraceContent(b.textContent);
      return withPerformanceTrace(
        {
          label: "observer:queryBlock",
          thresholdMs: 16,
          aggregateThresholdMs: 50,
          details: () => ({ content }),
        },
        () => renderQueryBlock(b, onloadArgs),
      );
    },
  });

  const canvasEmbedObserver = createButtonObserver({
    attribute: "dg-canvas",
    render: (b) => renderCanvasEmbed(b, onloadArgs),
  });

  let batchedTagNodes: DiscourseNode[] | null = null;
  const getNodesForTagBatch = (content: string): DiscourseNode[] => {
    if (batchedTagNodes === null) {
      let nodeCount = 0;
      batchedTagNodes = withPerformanceTrace(
        {
          label: "nodeTagPopupButtonObserver:getNodesForTagBatch",
          thresholdMs: 8,
          aggregateThresholdMs: 50,
          details: () => ({ nodeCount }),
        },
        () => {
          const trace = {
            source: "observer:nodeTagPopupButton:getNodesForTagBatch",
            content: compactTraceContent(content),
          };
          const settings = bulkReadSettings(trace);
          const nodes = getDiscourseNodes(undefined, settings, trace);
          nodeCount = nodes.length;
          return nodes;
        },
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
      let tagLength = 0;
      let rendered = false;
      let content: string | undefined;
      withPerformanceTrace(
        {
          label: "observer:nodeTagPopupButton",
          thresholdMs: 8,
          aggregateThresholdMs: 50,
          details: () => ({ tagLength, rendered, content }),
        },
        () => {
          const tag = s.getAttribute("data-tag");
          tagLength = tag?.length ?? 0;
          if (tag) {
            const normalizedTag = getCleanTagText(tag);
            content = compactTraceContent(normalizedTag);

            for (const node of getNodesForTagBatch(normalizedTag)) {
              const normalizedNodeTag = node.tag
                ? getCleanTagText(node.tag)
                : "";
              if (normalizedTag === normalizedNodeTag) {
                renderNodeTagPopupButton(s, node, onloadArgs.extensionAPI);
                rendered = true;
                const color = node.canvasSettings?.color ?? "";
                const tagStyles = color ? getNodeTagStyles(color) : {};
                if (tagStyles) {
                  Object.assign(s.style, tagStyles);
                }
                break;
              }
            }
          }
        },
      );
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

  if (getFeatureFlag("Suggestive mode overlay enabled")) {
    addPageRefObserver(getSuggestiveOverlayHandler(onloadArgs));
  }

  const graphOverviewExportObserver = createHTMLObserver({
    tag: "DIV",
    className: "rm-graph-view-control-panel__main-options",
    callback: (el) => {
      withPerformanceTrace(
        {
          label: "observer:graphOverviewExport",
          thresholdMs: 16,
          aggregateThresholdMs: 50,
        },
        () => {
          const div = el as HTMLDivElement;
          renderGraphOverviewExport(div);
        },
      );
    },
  });

  const imageMenuObserver = createHTMLObserver({
    tag: "IMG",
    className: "rm-inline-img",
    callback: (img: HTMLElement) => {
      let rendered = false;
      let content: string | undefined;
      withPerformanceTrace(
        {
          label: "observer:imageMenu",
          thresholdMs: 8,
          aggregateThresholdMs: 50,
          details: () => ({ rendered, content }),
        },
        () => {
          if (img instanceof HTMLImageElement) {
            content = compactTraceContent(
              img.currentSrc || img.src || img.getAttribute("src"),
            );
            renderImageToolsMenu(img, onloadArgs.extensionAPI);
            rendered = true;
          }
        },
      );
    },
  });

  if (settings.personalSettings[PERSONAL_KEYS.pagePreview])
    addPageRefObserver(previewPageRefHandler);

  if (settings.personalSettings[PERSONAL_KEYS.discourseContextOverlay]) {
    const overlayHandler = getOverlayHandler(onloadArgs);
    onPageRefObserverChange(overlayHandler)(true);
  }

  if (getPageRefObserversSize()) enablePageRefObserver();

  const configPageUid = getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE);

  const hashChangeListener = (e: Event) => {
    let checkedNodeCount = 0;
    let matchedConfigPage = false;
    let matchedNodeType = false;
    let refreshed = false;
    let content: string | undefined;
    withPerformanceTrace(
      {
        label: "listener:hashChange",
        thresholdMs: 8,
        aggregateThresholdMs: 50,
        details: () => ({
          checkedNodeCount,
          matchedConfigPage,
          matchedNodeType,
          refreshed,
          content,
        }),
      },
      () => {
        const evt = e as HashChangeEvent;
        content = compactTraceContent(evt.oldURL);
        const trace = {
          source: "listener:hashChange",
          content,
        };
        const settings = bulkReadSettings(trace);
        // Attempt to refresh config navigating away from config page
        // doesn't work if they update via sidebar
        matchedConfigPage =
          !!configPageUid && evt.oldURL.endsWith(configPageUid);
        const nodes = getDiscourseNodes(undefined, settings, trace);
        checkedNodeCount = nodes.length;
        matchedNodeType = nodes.some(({ type }) => evt.oldURL.endsWith(type));

        if (matchedConfigPage || matchedNodeType) {
          refreshConfigTree(settings);
          refreshed = true;
        }
      },
    );
  };

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

  const unsubGlobalTrigger = onSettingChange(
    settingKeys.globalTrigger,
    (newValue) => {
      globalTrigger = (newValue as string).trim();
    },
  );

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

  const leftSidebarObserver = createHTMLObserver({
    tag: "DIV",
    useBody: true,
    className: "starred-pages-wrapper",
    callback: (el) => {
      let isLeftSidebarEnabled = false;
      const content = "starred-pages-wrapper";
      void withAsyncPerformanceTrace(
        {
          label: "observer:leftSidebar",
          thresholdMs: 16,
          aggregateThresholdMs: 50,
          details: () => ({ isLeftSidebarEnabled, content }),
        },
        async () => {
          const settings = bulkReadSettings({
            source: "observer:leftSidebar",
            content,
          });
          isLeftSidebarEnabled = settings.featureFlags["Enable left sidebar"];
          const container = el as HTMLDivElement;
          if (isLeftSidebarEnabled) {
            container.style.padding = "0";
            await mountLeftSidebar({
              wrapper: container,
              onloadArgs,
              initialSnapshot: settings,
            });
          }
        },
      );
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
        trace: {
          source: "listener:nodeMenuTrigger",
          content: compactTraceContent(textarea.value),
        },
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
    let selectedTextLength = 0;
    let hasBlockElement = false;
    let rendered = false;
    let content: string | undefined;
    withPerformanceTrace(
      {
        label: "listener:selectionchange",
        thresholdMs: 8,
        aggregateThresholdMs: 50,
        details: () => ({
          selectedTextLength,
          hasBlockElement,
          rendered,
          content,
        }),
      },
      () => {
        const settings = bulkReadSettings({
          source: "listener:selectionchange",
        });
        if (!settings.personalSettings[PERSONAL_KEYS.textSelectionPopup])
          return;

        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0 || !selection.focusNode) {
          removeTextSelectionPopup();
          return;
        }

        const selectedText = selection.toString().trim();
        selectedTextLength = selectedText.length;
        content = compactTraceContent(selectedText);

        if (!selectedText) {
          removeTextSelectionPopup();
          return;
        }

        const blockElement = findBlockElementFromSelection();
        hasBlockElement = !!blockElement;

        if (blockElement) {
          const textarea = blockElement.querySelector("textarea");
          if (!textarea) return;

          renderTextSelectionPopup({
            extensionAPI: onloadArgs.extensionAPI,
            blockElement,
            textarea,
          });
          rendered = true;
        } else {
          removeTextSelectionPopup();
        }
      },
    );
  }, 150);

  return {
    observers: [
      pageTitleObserver,
      queryBlockObserver,
      canvasEmbedObserver,
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
