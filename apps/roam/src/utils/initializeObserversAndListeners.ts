import {
  createHTMLObserver,
  createButtonObserver,
  getPageTitleValueByHtmlElement,
} from "roamjs-components/dom";
import { createBlock } from "roamjs-components/writes";
import { renderLinkedReferenceAdditions } from "~/utils/renderLinkedReferenceAdditions";
import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import { renderTldrawCanvas } from "~/components/canvas/Tldraw";
import { renderQueryPage, renderQueryBlock } from "~/components/QueryBuilder";
import {
  configPageTabs,
  DISCOURSE_CONFIG_PAGE_TITLE,
  renderNodeConfigPage,
} from "~/settings/configPages";
import isFlagEnabled from "~/utils/isFlagEnabled";
import { isCurrentPageCanvas as isCanvasPage } from "~/utils/isCanvasPage";
import { isDiscourseNodeConfigPage as isNodeConfigPage } from "~/utils/isDiscourseNodeConfigPage";
import { isQueryPage } from "~/utils/isQueryPage";
import {
  enablePageRefObserver,
  addPageRefObserver,
  getPageRefObserversSize,
  previewPageRefHandler,
} from "~/utils/pageRefObserverHandlers";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import { OnloadArgs } from "roamjs-components/types";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { render as renderGraphOverviewExport } from "~/components/ExportDiscourseContext";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { getSettingValueFromTree } from "roamjs-components/util";
import { render as renderDiscourseNodeMenu } from "~/components/DiscourseNodeMenu";

export const initObservers = async ({
  onloadArgs,
}: {
  onloadArgs: OnloadArgs;
}): Promise<{
  observers: MutationObserver[];
  listeners: EventListener[];
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

  if (isFlagEnabled("preview")) addPageRefObserver(previewPageRefHandler);
  // TODO: grammar overlay being refactored
  // if (isFlagEnabled("grammar.overlay")) {
  //   addPageRefObserver((s) => overlayPageRefHandler(s, onloadArgs));
  // }
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
  const trigger = getSettingValueFromTree({
    tree: configTree,
    key: "trigger",
    defaultValue: "\\",
  }).trim();
  const nodeMenuTriggerListener = (e: Event) => {
    const evt = e as KeyboardEvent;
    if (evt.key === trigger) {
      const target = evt.target as HTMLElement;
      if (
        target.tagName === "TEXTAREA" &&
        target.classList.contains("rm-block-input")
      ) {
        renderDiscourseNodeMenu({ textarea: target as HTMLTextAreaElement });
        evt.preventDefault();
        evt.stopPropagation();
      }
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
    listeners: [
      pageActionListener,
      hashChangeListener,
      nodeMenuTriggerListener,
    ],
  };
};
