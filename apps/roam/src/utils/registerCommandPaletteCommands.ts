import { openCanvasDrawer } from "~/components/canvas/CanvasDrawer";
import { openQueryDrawer } from "~/components/QueryDrawer";
import { render as exportRender } from "~/components/Export";
import { render as renderToast } from "roamjs-components/components/Toast";
import { createBlock, updateBlock } from "roamjs-components/writes";
import {
  getCurrentPageUid,
  getBlockUidFromTarget,
} from "roamjs-components/dom";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodes from "./getDiscourseNodes";
import fireQuery from "./fireQuery";
import { excludeDefaultNodes } from "~/utils/getDiscourseNodes";
import { render as renderSettings } from "~/components/settings/Settings";

export const registerCommandPaletteCommands = (onloadArgs: OnloadArgs) => {
  const { extensionAPI } = onloadArgs;

  const createQueryBlock = async () => {
    {
      const uid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      if (!uid) {
        renderToast({
          id: "query-builder-create-block",
          content: "Must be focused on a block to create a Query Block",
        });
        return;
      }

      // setTimeout is needed because sometimes block is left blank
      setTimeout(async () => {
        await updateBlock({
          uid,
          text: "{{query block}}",
          open: false,
        });
      }, 200);

      await createBlock({
        node: {
          text: "scratch",
          children: [
            { text: "custom" },
            { text: "selections" },
            {
              text: "conditions",
              children: [
                {
                  text: "clause",
                  children: [
                    {
                      text: "source",
                      children: [{ text: "node" }],
                    },
                    { text: "relation" },
                  ],
                },
              ],
            },
          ],
        },
        parentUid: uid,
      });
      document.querySelector("body")?.click();
      // TODO replace with document.body.dispatchEvent(new CustomEvent)
      setTimeout(() => {
        const el = document.querySelector(`.roam-block[id*="${uid}"]`);
        const conditionEl = el?.querySelector(
          ".roamjs-query-condition-relation",
        );
        const conditionInput = conditionEl?.querySelector(
          "input",
        ) as HTMLInputElement;
        conditionInput?.focus();
      }, 200);
    }
  };

  const openQueryDrawerWithArgs = () => {
    openQueryDrawer(onloadArgs);
  };

  const exportCurrentPage = () => {
    const pageUid = getCurrentPageUid();
    const pageTitle = getPageTitleByPageUid(pageUid);
    exportRender({
      results: [
        {
          uid: pageUid,
          text: pageTitle,
        },
      ],
      title: "Export Current Page",
      initialPanel: "export",
    });
  };

  const exportDiscourseGraph = async () => {
    const discourseNodes = getDiscourseNodes().filter(excludeDefaultNodes);
    const results = await Promise.all(
      discourseNodes.map(async (d) => {
        const queryResults = await fireQuery({
          returnNode: "node",
          conditions: [
            {
              relation: "is a",
              source: "node",
              target: d.type,
              uid: window.roamAlphaAPI.util.generateUID(),
              type: "clause",
            },
          ],
          selections: [],
        });
        return queryResults.map((result) => ({ ...result, type: d.type }));
      }),
    );

    exportRender({
      results: results.flat(),
      title: "Export Discourse Graph",
      isExportDiscourseGraph: true,
      initialPanel: "export",
    });
  };

  const refreshCurrentQueryBuilder = () => {
    const target = document.activeElement as HTMLElement;
    const uid = getBlockUidFromTarget(target);
    document.body.dispatchEvent(
      new CustomEvent("roamjs-query-builder:fire-query", { detail: uid }),
    );
  };

  const renderSettingsPopup = () => renderSettings({ onloadArgs });

  const addCommand = (label: string, callback: () => void) => {
    return extensionAPI.ui.commandPalette.addCommand({
      label,
      callback,
    });
  };

  // Roam organizes commands by alphabetically
  addCommand("DG: Export - Current Page", exportCurrentPage);
  addCommand("DG: Export - Discourse Graph", exportDiscourseGraph);
  addCommand("DG: Open - Canvas Drawer", openCanvasDrawer);
  addCommand("DG: Open - Discourse Settings", renderSettingsPopup);
  addCommand("DG: Open - Query Drawer", openQueryDrawerWithArgs);
  addCommand("DG: Query Block - Create", createQueryBlock);
  addCommand("DG: Query Block - Refresh", refreshCurrentQueryBuilder);
};
