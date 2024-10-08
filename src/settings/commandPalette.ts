import { openCanvasDrawer } from "../components/Tldraw/CanvasDrawer";
import { openQueryDrawer } from "../components/QueryDrawer";
import { render as exportRender } from "../components/Export";
import { render as renderToast } from "roamjs-components/components/Toast";
import { createBlock, updateBlock } from "roamjs-components/writes";
import {
  getCurrentPageUid,
  getBlockUidFromTarget,
} from "roamjs-components/dom";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodes from "../utils/getDiscourseNodes";
import { DiscourseExportResult } from "../utils/getExportTypes";
import fireQuery from "../utils/fireQuery";

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
          ".roamjs-query-condition-relation"
        );
        const conditionInput = conditionEl?.querySelector(
          "input"
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

  const exportDiscourseGraph = () => {
    const discourseNodes = getDiscourseNodes().filter(
      (r) => r.backedBy !== "default"
    );
    const results: (
      isSamePageEnabled: boolean
    ) => Promise<DiscourseExportResult[]> = (isSamePageEnabled: boolean) =>
      Promise.all(
        discourseNodes.map((d) =>
          fireQuery({
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
            isSamePageEnabled,
          }).then((queryResults) =>
            queryResults.map((result) => ({
              ...result,
              type: d.type,
            }))
          )
        )
      ).then((r) => r.flat());
    exportRender({
      results,
      title: "Export Discourse Graph",
      isExportDiscourseGraph: true,
      initialPanel: "export",
    });
  };

  const refreshCurrentQueryBuilder = () => {
    const target = document.activeElement as HTMLElement;
    const uid = getBlockUidFromTarget(target);
    document.body.dispatchEvent(
      new CustomEvent("roamjs-query-builder:fire-query", { detail: uid })
    );
  };

  const addCommand = (label: string, callback: () => void) => {
    return extensionAPI.ui.commandPalette.addCommand({
      label,
      callback,
    });
  };
  addCommand("Open Canvas Drawer", openCanvasDrawer);
  addCommand("Open Query Drawer", openQueryDrawerWithArgs);
  addCommand("Create Query Block", createQueryBlock);
  addCommand("Export Current Page", exportCurrentPage);
  addCommand("Export Discourse Graph", exportDiscourseGraph);
  addCommand("Refresh Current Query Builder", refreshCurrentQueryBuilder);
};
