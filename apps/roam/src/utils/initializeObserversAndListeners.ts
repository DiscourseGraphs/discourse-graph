import {
  createHTMLObserver,
  createButtonObserver,
  getPageTitleValueByHtmlElement,
  getBlockUidFromTarget,
} from "roamjs-components/dom";
import { createBlock } from "roamjs-components/writes";
import { renderLinkedReferenceAdditions } from "~/utils/renderLinkedReferenceAdditions";
import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import { renderTldrawCanvas } from "~/components/canvas/Tldraw";
import { renderQueryPage, renderQueryBlock } from "~/components/QueryBuilder";
import {
  DISCOURSE_CONFIG_PAGE_TITLE,
  renderNodeConfigPage,
} from "~/utils/renderNodeConfigPage";
import { isCurrentPageCanvas as isCanvasPage } from "~/utils/isCanvasPage";
import { isDiscourseNodeConfigPage as isNodeConfigPage } from "~/utils/isDiscourseNodeConfigPage";
import { isQueryPage } from "~/utils/isQueryPage";
import {
  enablePageRefObserver,
  addPageRefObserver,
  getPageRefObserversSize,
  previewPageRefHandler,
  overlayPageRefHandler,
} from "~/utils/pageRefObserverHandlers";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
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
import { render as renderInlineSuggestions } from "~/components/InlineSuggestions";

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

      if (isNodeConfigPage(title)) renderNodeConfigPage(props);
      else if (isQueryPage(props)) renderQueryPage(props);
      else if (isCanvasPage(props)) renderTldrawCanvas(props);
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

  const inlineSuggestiveModeButtonObserver = createButtonObserver({
    attribute: "inline-suggestive-mode",
    render: (button) => {
      setTimeout(() => {
        const btn = button as HTMLButtonElement;
        const blockContainer = btn.closest<HTMLElement>(
          ".roam-block-container",
        );
        if (!blockContainer) {
          return;
        }

        // Prevents re-rendering if the component is already there
        if (
          blockContainer.querySelector(".roamjs-discourse-inline-suggestions")
        ) {
          return;
        }

        const childrenContainer =
          blockContainer.querySelector<HTMLElement>(".rm-block-children");
        if (!childrenContainer) {
          return;
        }

        const candidateInputs = Array.from(
          childrenContainer.querySelectorAll<HTMLElement>(".rm-block__input"),
        );
        const tagBlockInput = candidateInputs.find((el) =>
          el.querySelector(".rm-page-ref"),
        ) as HTMLElement | undefined;
        const tag = tagBlockInput?.textContent?.trim();

        if (!tag) {
          console.error(
            "Discourse Graph: Could not find tag in child block for inline suggestions.",
          );
          return;
        }

        childrenContainer.style.display = "none";

        const blockInput = btn.closest(".rm-block__input");
        if (!blockInput) {
          return;
        }
        blockInput.innerHTML = "";
        const placeholder = document.createElement("div");
        blockInput.appendChild(placeholder);

        const parentBlockContainer =
          blockContainer.parentElement?.closest<HTMLElement>(
            ".roam-block-container",
          );

        const parentBlockInput =
          parentBlockContainer?.querySelector<HTMLElement>(".rm-block__input");

        const blockUid = getBlockUidFromTarget(
          (parentBlockInput as HTMLElement) ||
            parentBlockContainer ||
            blockContainer,
        );
        renderInlineSuggestions({
          parent: placeholder,
          tag,
          blockUid,
          onloadArgs,
        });
      }, 50);
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
      inlineSuggestiveModeButtonObserver,
      configPageObserver,
      linkedReferencesObserver,
      graphOverviewExportObserver,
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
