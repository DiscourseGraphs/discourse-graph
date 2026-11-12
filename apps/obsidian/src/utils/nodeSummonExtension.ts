import { EditorView, type ViewUpdate } from "@codemirror/view";
import type DiscourseGraphPlugin from "~/index";
import {
  closeNodeSummonMenu,
  getActiveNodeSummonMenu,
  openNodeSummonMenu,
} from "~/components/NodeSummonMenu";
import { getTypedTriggerStart } from "~/utils/nodeSearchTrigger";

// Keeps the open menu's query in sync, or closes it once the trigger is gone.
const updateOpenMenu = (update: ViewUpdate): boolean => {
  const menu = getActiveNodeSummonMenu();
  if (!menu || menu.view !== update.view) return false;
  if (!update.docChanged && !update.selectionSet) {
    if (update.geometryChanged) menu.reposition();
    return true;
  }

  const { doc, selection } = update.state;
  const triggerFrom = update.changes.mapPos(menu.triggerFrom);
  const queryFrom = triggerFrom + menu.trigger.length;
  const head = selection.main.head;

  const triggerIntact =
    queryFrom <= doc.length &&
    doc.sliceString(triggerFrom, queryFrom) === menu.trigger;
  const cursorInQuery =
    selection.main.empty &&
    head >= queryFrom &&
    doc.lineAt(head).number === doc.lineAt(triggerFrom).number;

  if (!triggerIntact || !cursorInQuery) {
    closeNodeSummonMenu();
    return true;
  }

  menu.triggerFrom = triggerFrom;
  menu.setQuery(doc.sliceString(queryFrom, head));
  // Text inserted above the trigger moves it on screen.
  if (update.docChanged || update.geometryChanged) menu.reposition();
  return true;
};

export const createNodeSummonExtension = (plugin: DiscourseGraphPlugin) =>
  EditorView.updateListener.of((update) => {
    if (updateOpenMenu(update)) return;

    // Only typing opens it; moving the cursor back into existing `@text` does not.
    const typed = update.transactions.some((tr) =>
      tr.isUserEvent("input.type"),
    );
    if (!update.docChanged || !typed) return;

    const { doc, selection } = update.state;
    if (!selection.main.empty) return;
    const head = selection.main.head;
    const line = doc.lineAt(head);
    const trigger = plugin.settings.nodeSearchTrigger;
    const start = getTypedTriggerStart({
      lineBeforeCursor: doc.sliceString(line.from, head),
      trigger,
    });
    if (start === null) return;

    openNodeSummonMenu({
      plugin,
      view: update.view,
      triggerFrom: line.from + start,
      trigger,
    });
  });
