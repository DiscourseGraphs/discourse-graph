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
import { renderModifyNodeDialog } from "~/components/ModifyNodeDialog";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getUids from "roamjs-components/dom/getUids";
import {
  getOverlayHandler,
  onPageRefObserverChange,
} from "./pageRefObserverHandlers";
import { HIDE_METADATA_KEY } from "~/data/userSettings";
import posthog from "posthog-js";

export const registerCommandPaletteCommands = (onloadArgs: OnloadArgs) => {
  const { extensionAPI } = onloadArgs;

  const insertPageReferenceAtCursor = async ({
    blockUid,
    pageTitle,
    selectionStart,
    windowId,
  }: {
    blockUid: string;
    pageTitle: string;
    selectionStart: number;
    windowId: string;
  }): Promise<void> => {
    const originalText = getTextByBlockUid(blockUid) || "";
    const pageRef = `[[${pageTitle}]]`;
    const newText = `${originalText.substring(0, selectionStart)}${pageRef}${originalText.substring(selectionStart)}`;
    const newCursorPosition = selectionStart + pageRef.length;

    await updateBlock({ uid: blockUid, text: newText });

    if (window.roamAlphaAPI.ui.setBlockFocusAndSelection) {
      await window.roamAlphaAPI.ui.setBlockFocusAndSelection({
        location: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "block-uid": blockUid,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "window-id": windowId,
        },
        selection: { start: newCursorPosition },
      });
      return;
    }

    setTimeout(() => {
      const textareaElements = document.querySelectorAll("textarea");
      for (const el of textareaElements) {
        if (getUids(el).blockUid === blockUid) {
          el.focus();
          el.setSelectionRange(newCursorPosition, newCursorPosition);
          break;
        }
      }
    }, 50);
  };

  const createQueryBlock = async () => {
    {
      const uid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      posthog.capture("Query Block: Create Command Triggered", {
        hasFocusedBlock: !!uid,
      });
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
    posthog.capture("Export: Current Page Command Triggered", {
      pageUid,
      pageTitle,
    });
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
    posthog.capture("Export: Discourse Graph Command Triggered");
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
    posthog.capture("Query Block: Refresh Command Triggered", {
      uid: uid || "",
      hasUid: !!uid,
    });
    document.body.dispatchEvent(
      new CustomEvent("roamjs-query-builder:fire-query", { detail: uid }),
    );
  };

  const renderSettingsPopup = () => {
    posthog.capture("Settings: Open Command Triggered");
    renderSettings({ onloadArgs });
  };

  const createDiscourseNodeFromCommand = () => {
    const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
    const blockUid = focusedBlock?.["block-uid"];
    const windowId = focusedBlock?.["window-id"] || "main-window";
    const activeElement = document.activeElement;
    const isFocusedTextarea =
      activeElement instanceof HTMLTextAreaElement &&
      activeElement.classList.contains("rm-block-input");
    const selectionStart = isFocusedTextarea
      ? activeElement.selectionStart
      : null;

    if (!blockUid || selectionStart === null) {
      renderToast({
        id: "create-discourse-node-command-focus",
        content: "Place your cursor in a block before running this command.",
      });
      return;
    }

    const defaultNodeType =
      getDiscourseNodes().filter(excludeDefaultNodes)[0]?.type;
    if (!defaultNodeType) {
      renderToast({
        id: "create-discourse-node-command-no-types",
        content: "No discourse node types found in settings.",
      });
      return;
    }

    renderModifyNodeDialog({
      mode: "create",
      nodeType: defaultNodeType,
      initialValue: { text: "", uid: "" },
      extensionAPI,
      onSuccess: async (result) => {
        await insertPageReferenceAtCursor({
          blockUid,
          pageTitle: result.text,
          selectionStart,
          windowId,
        });
      },
      onClose: () => {},
    });
  };

  const toggleDiscourseContextOverlay = async () => {
    const currentValue =
      (extensionAPI.settings.get("discourse-context-overlay") as boolean) ??
      false;
    const newValue = !currentValue;
    try {
      await extensionAPI.settings.set("discourse-context-overlay", newValue);
    } catch (error) {
      const e = error as Error;
      renderToast({
        id: "discourse-context-overlay-toggle-error",
        content: `Failed to toggle discourse context overlay: ${e.message}`,
      });
      return;
    }
    const overlayHandler = getOverlayHandler(onloadArgs);
    onPageRefObserverChange(overlayHandler)(newValue);
    posthog.capture("Discourse Context Overlay: Toggled via Command", {
      enabled: newValue,
    });
    renderToast({
      id: "discourse-context-overlay-toggle",
      content: `Discourse context overlay ${newValue ? "enabled" : "disabled"}`,
    });
  };

  const toggleQueryMetadata = async () => {
    const currentValue =
      (extensionAPI.settings.get(HIDE_METADATA_KEY) as boolean) ?? true;
    const newValue = !currentValue;
    try {
      await extensionAPI.settings.set(HIDE_METADATA_KEY, newValue);
    } catch (error) {
      const e = error as Error;
      renderToast({
        id: "query-metadata-toggle-error",
        content: `Failed to toggle query metadata: ${e.message}`,
      });
      return;
    }
    posthog.capture("Query Metadata: Toggled via Command", {
      hidden: newValue,
    });
    renderToast({
      id: "query-metadata-toggle",
      content: `Query metadata ${newValue ? "hidden" : "shown"}`,
    });
  };

  const addCommand = (label: string, callback: () => void) => {
    return extensionAPI.ui.commandPalette.addCommand({
      label,
      callback,
    });
  };

  // Roam organizes commands alphabetically
  void addCommand("DG: Export - Current page", exportCurrentPage);
  void addCommand("DG: Export - Discourse graph", exportDiscourseGraph);
  void addCommand("DG: Open - Discourse settings", renderSettingsPopup);
  void addCommand("DG: Open - Query drawer", openQueryDrawerWithArgs);
  void addCommand(
    "DG: Create - Discourse node at cursor",
    createDiscourseNodeFromCommand,
  );
  void addCommand(
    "DG: Toggle - Discourse context overlay",
    toggleDiscourseContextOverlay,
  );
  void addCommand(
    "DG: Toggle - Hide query metadata",
    () => void toggleQueryMetadata(),
  );
  void addCommand("DG: Query block - Create", createQueryBlock);
  void addCommand("DG: Query block - Refresh", refreshCurrentQueryBuilder);
};
