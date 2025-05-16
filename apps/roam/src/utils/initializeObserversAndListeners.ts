import {
  createHTMLObserver,
  createButtonObserver,
  getPageTitleValueByHtmlElement,
} from "roamjs-components/dom";
import { createBlock, updateBlock } from "roamjs-components/writes";
import getUids from "roamjs-components/dom/getUids";
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

  const nodeSearchTriggerCombo =
    (onloadArgs.extensionAPI.settings.get(
      "discourse-node-search-trigger",
    ) as IKeyCombo) || undefined;
  const handleNodeMenuRender = (target: HTMLElement, evt: KeyboardEvent) => {
    if (
      target.tagName === "TEXTAREA" &&
      target.classList.contains("rm-block-input")
    ) {
      renderDiscourseNodeMenu({
        textarea: target as HTMLTextAreaElement,
        extensionAPI: onloadArgs.extensionAPI,
      });
      evt.preventDefault();
      evt.stopPropagation();
    }
  };

  const handleNodeSearchRender = (target: HTMLElement, evt: KeyboardEvent) => {
    if (
      target.tagName === "TEXTAREA" &&
      target.classList.contains("rm-block-input")
    ) {
      const textarea = target as HTMLTextAreaElement;
      const location = window.roamAlphaAPI.ui.getFocusedBlock();
      if (!location) return;

      const cursorPos = textarea.selectionStart;
      const isBeginningOrAfterSpace =
        cursorPos === 0 ||
        textarea.value.charAt(cursorPos - 1) === " " ||
        textarea.value.charAt(cursorPos - 1) === "\n";

      if (isBeginningOrAfterSpace) {
        // Don't insert the trigger for key combinations that already produce the character
        // (e.g., Shift+2 already produces @)
        const triggerChar = nodeSearchTriggerCombo?.key || "@";

        // The position where the menu should appear (at the start of the trigger character)
        let triggerPosition = cursorPos;

        // For key combinations like Ctrl+key that wouldn't naturally insert characters
        if (!evt.isComposing && evt.key !== triggerChar) {
          // Insert the trigger character at the cursor position
          const text = textarea.value;
          const newText =
            text.slice(0, cursorPos) + triggerChar + text.slice(cursorPos);

          // Update the text - this needs to use updateBlock because directly modifying
          // textarea.value doesn't trigger Roam's internal state updates
          const blockUid = getUids(textarea).blockUid;
          if (blockUid) {
            updateBlock({ uid: blockUid, text: newText });
          }

          // The menu should appear at the current cursor position
          triggerPosition = cursorPos;
        }

        renderDiscourseNodeSearchMenu({
          onClose: () => {},
          textarea: textarea,
          triggerPosition: triggerPosition,
          extensionAPI: onloadArgs.extensionAPI,
        });

        evt.preventDefault();
        evt.stopPropagation();
      }
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

  const discourseNodeSearchTriggerListener = (e: Event) => {
    const evt = e as KeyboardEvent;
    const target = evt.target as HTMLElement;
    if (document.querySelector(".discourse-node-search-menu")) return;

    // If no personal trigger is set or key is empty, the feature is disabled
    if (!nodeSearchTriggerCombo?.key) return;

    const personalTrigger = nodeSearchTriggerCombo.key;
    const personalModifiers = getModifiersFromCombo(nodeSearchTriggerCombo);

    let triggerMatched = false;

    console.log("evt.key", evt.key);
    console.log("personal trigger", personalTrigger, nodeSearchTriggerCombo);
    if (evt.key === personalTrigger) {
      triggerMatched =
        (!personalModifiers.includes("ctrl") || evt.ctrlKey) &&
        (!personalModifiers.includes("shift") || evt.shiftKey) &&
        (!personalModifiers.includes("alt") || evt.altKey) &&
        (!personalModifiers.includes("meta") || evt.metaKey);
    }

    if (triggerMatched) {
      handleNodeSearchRender(target, evt);
    }
  };

  return {
    observers: [
      pageTitleObserver,
      queryBlockObserver,
      configPageObserver,
      linkedReferencesObserver,
      graphOverviewExportObserver,
    ].filter((o): o is MutationObserver => !!o),
    listeners: {
      pageActionListener,
      hashChangeListener,
      nodeMenuTriggerListener,
      discourseNodeSearchTriggerListener,
    },
  };
};
