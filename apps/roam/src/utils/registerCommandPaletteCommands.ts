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
import findDiscourseNode from "~/utils/findDiscourseNode";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import stripUid from "roamjs-components/util/stripUid";
import { HIDE_METADATA_KEY } from "~/data/userSettings";
import posthog from "posthog-js";
import { extractRef } from "roamjs-components/util";
import discourseConfigRef from "~/utils/discourseConfigRef";
import { getLeftSidebarPersonalSectionConfig } from "~/utils/getLeftSidebarSettings";
import { getUidAndBooleanSetting } from "~/utils/getExportSettings";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { refreshAndNotify } from "~/components/LeftSidebarView";
import { setPersonalSetting } from "~/components/settings/utils/accessors";
import { sectionsToBlockProps } from "~/components/settings/LeftSidebarPersonalSettings";

type BlockSelection = {
  selectionStart: number;
  selectionEnd: number;
  selectedText: string;
};

const getBlockSelection = (uid: string): BlockSelection => {
  const activeElement = document.activeElement;
  const isFocusedTextarea =
    activeElement instanceof HTMLTextAreaElement &&
    activeElement.classList.contains("rm-block-input") &&
    getUids(activeElement).blockUid === uid;
  if (isFocusedTextarea) {
    return {
      selectionStart: activeElement.selectionStart,
      selectionEnd: activeElement.selectionEnd,
      selectedText: activeElement.value.substring(
        activeElement.selectionStart,
        activeElement.selectionEnd,
      ),
    };
  }
  const textareas = document.querySelectorAll("textarea.rm-block-input");
  for (const el of textareas) {
    const textarea = el as HTMLTextAreaElement;
    if (getUids(textarea).blockUid === uid) {
      return {
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
        selectedText: textarea.value.substring(
          textarea.selectionStart,
          textarea.selectionEnd,
        ),
      };
    }
  }
  const textLength = (getTextByBlockUid(uid) || "").length;
  return {
    selectionStart: textLength,
    selectionEnd: textLength,
    selectedText: "",
  };
};

export const createDiscourseNodeFromCommand = (
  extensionAPI: OnloadArgs["extensionAPI"],
) => {
  posthog.capture("Discourse Node: Create Command Triggered");
  const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
  const uid = focusedBlock?.["block-uid"];
  const windowId = focusedBlock?.["window-id"] || "main-window";

  const { selectionStart, selectionEnd, selectedText } = uid
    ? getBlockSelection(uid)
    : { selectionStart: 0, selectionEnd: 0, selectedText: "" };

  renderModifyNodeDialog({
    mode: "create",
    nodeType: "",
    initialValue: { text: selectedText, uid: "" },
    extensionAPI,
    onSuccess: async (result) => {
      if (!uid) {
        renderToast({
          id: "create-discourse-node-command-no-block",
          content: "No block focused to insert a discourse node.",
        });
        return;
      }
      const originalText = getTextByBlockUid(uid) || "";
      const pageRef = `[[${result.text}]]`;
      const newText = `${originalText.substring(0, selectionStart)}${pageRef}${originalText.substring(selectionEnd)}`;
      const newCursorPosition = selectionStart + pageRef.length;

      await updateBlock({ uid, text: newText });

      await window.roamAlphaAPI.ui.setBlockFocusAndSelection({
        location: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "block-uid": uid,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "window-id": windowId,
        },
        selection: { start: newCursorPosition },
      });
      return;
    },
    onClose: () => {},
  });
};

export const convertPageToNodeFromCommand = (
  extensionAPI: OnloadArgs["extensionAPI"],
) => {
  posthog.capture("Discourse Node: Convert Command Triggered");
  const pageUid = getCurrentPageUid();
  if (!pageUid) {
    renderToast({
      id: "convert-page-no-page",
      content: "Navigate to a page to convert it to a discourse node.",
    });
    return;
  }

  const pageTitle = getPageTitleByPageUid(pageUid);
  if (!pageTitle) {
    renderToast({
      id: "convert-page-no-title",
      content: "Could not determine the current page title.",
    });
    return;
  }

  const existingNode = findDiscourseNode({ uid: pageUid, title: pageTitle });
  if (existingNode && existingNode.backedBy !== "default") {
    renderToast({
      id: "convert-page-already-node",
      content: `This page is already a ${existingNode.text} node.`,
    });
    return;
  }

  renderModifyNodeDialog({
    mode: "create",
    nodeType: "",
    initialValue: { text: pageTitle, uid: "" },
    extensionAPI,
    createOverride: async ({ formattedTitle, configPageUid }) => {
      await window.roamAlphaAPI.data.page.update({
        page: { uid: pageUid, title: formattedTitle },
      });

      const nodeTree = getFullTreeByParentUid(configPageUid).children;
      const templateNode = getSubTree({ tree: nodeTree, key: "template" });
      if (templateNode.children.length > 0) {
        const existingChildren = getFullTreeByParentUid(pageUid).children || [];
        const lastOrder = existingChildren.length;
        await Promise.all(
          stripUid(templateNode.children).map(({ uid, ...node }, order) =>
            createBlock({ node, order: lastOrder + order, parentUid: pageUid }),
          ),
        );
      }

      return pageUid;
    },
    onSuccess: async () => {},
    onClose: () => {},
  });
};

export const registerCommandPaletteCommands = (onloadArgs: OnloadArgs) => {
  const { extensionAPI } = onloadArgs;

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
  void addCommand("DG: Convert current page to discourse node", () =>
    convertPageToNodeFromCommand(extensionAPI),
  );
  void addCommand("DG: Create/Insert discourse node", () =>
    createDiscourseNodeFromCommand(extensionAPI),
  );
  void addCommand("DG: Export - Current page", exportCurrentPage);
  void addCommand("DG: Export - Discourse graph", exportDiscourseGraph);
  void addCommand("DG: Open - Discourse settings", renderSettingsPopup);
  void addCommand("DG: Open - Query drawer", openQueryDrawerWithArgs);
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

  const leftSidebarEnabled = getUidAndBooleanSetting({
    tree: discourseConfigRef.tree,
    text: "(BETA) Left Sidebar",
  });
  if (leftSidebarEnabled.value) {
    const leftSidebarNode = discourseConfigRef.tree.find(
      (node) => node.text === "Left Sidebar",
    );
    const personalSections = getLeftSidebarPersonalSectionConfig(
      leftSidebarNode?.children || [],
    ).sections;

    for (const section of personalSections) {
      if (!section.childrenUid) continue;

      const sectionName = section.text.startsWith("((")
        ? getTextByBlockUid(extractRef(section.text)) || section.text
        : section.text;

      window.roamAlphaAPI.ui.blockContextMenu.addCommand({
        label: `DG: Favorites - Add to "${sectionName}" section`,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        callback: (props: { "block-uid": string }) => {
          void addBlockToPersonalSection({
            blockUid: props["block-uid"],
            sectionUid: section.uid,
            onloadArgs,
          });
        },
      });
    }
  }
};

const addBlockToPersonalSection = async ({
  blockUid,
  sectionUid,
  onloadArgs,
}: {
  blockUid: string;
  sectionUid: string;
  onloadArgs: OnloadArgs;
}) => {
  refreshConfigTree();
  const leftSidebarNode = discourseConfigRef.tree.find(
    (node) => node.text === "Left Sidebar",
  );
  const sections = getLeftSidebarPersonalSectionConfig(
    leftSidebarNode?.children || [],
  ).sections;
  const section = sections.find((s) => s.uid === sectionUid);
  if (!section?.childrenUid) return;

  const blockRef = `((${blockUid}))`;

  try {
    const newChildBlockUid = await createBlock({
      parentUid: section.childrenUid,
      order: "last",
      node: { text: blockRef },
    });

    const updatedSections = sections.map((s) =>
      s.uid === sectionUid
        ? {
            ...s,
            children: [
              ...(s.children || []),
              {
                text: blockRef,
                uid: newChildBlockUid,
                children: [],
                alias: { value: "" },
              },
            ],
          }
        : s,
    );

    setPersonalSetting(["Left sidebar"], sectionsToBlockProps(updatedSections));
    refreshAndNotify();
    renderSettings({
      onloadArgs,
      selectedTabId: "left-sidebar-personal-settings",
      expandedSectionUid: sectionUid,
    });
  } catch {
    renderToast({
      content: "Failed to add block to section",
      intent: "danger",
      id: "add-block-to-section-error",
    });
  }
};
