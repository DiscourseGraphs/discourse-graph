import {
  type PluginValue,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  Decoration,
  type DecorationSet,
  EditorView,
} from "@codemirror/view";
import { editorInfoField, editorLivePreviewField } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { createDiscourseContextBadge } from "~/components/discourseContextBadge";
import { openDiscourseContextPopover } from "~/components/DiscourseContextPopover";
import {
  resolveDiscourseLinkTarget,
  type DiscourseLinkTarget,
} from "./discourseLinkUtils";

// Wikilinks [[...]] and markdown links [text](path.md). Embeds are excluded in
// the loop below, since a leading "!" sits outside the match.
const INTERNAL_LINK_RE = /\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+\.md)\)/g;

/** Extracts the link target from a wikilink or markdown link match. */
const extractLinktext = (match: string): string => {
  if (match.startsWith("[[")) {
    const inner = match.slice(2, -2);
    const pipeIndex = inner.indexOf("|");
    return pipeIndex >= 0 ? inner.slice(0, pipeIndex) : inner;
  }

  const parenOpen = match.lastIndexOf("(");
  const rawPath = match.slice(parenOpen + 1, -1);
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
};

class DiscourseContextBadgeWidget extends WidgetType {
  constructor(
    private target: DiscourseLinkTarget,
    private plugin: DiscourseGraphPlugin,
  ) {
    super();
  }

  /**
   * Keyed on path and count so a badge is only rebuilt when what it displays
   * changes — not on every keystroke elsewhere in the document.
   */
  eq(other: DiscourseContextBadgeWidget): boolean {
    return (
      this.target.file.path === other.target.file.path &&
      this.target.relationCount === other.target.relationCount
    );
  }

  toDOM(): HTMLElement {
    return createDiscourseContextBadge({
      file: this.target.file,
      nodeType: this.target.nodeType,
      relationCount: this.target.relationCount,
      onActivate: ({ file, anchor }) =>
        openDiscourseContextPopover({
          plugin: this.plugin,
          file,
          anchor,
          relationCount: this.target.relationCount,
        }),
    });
  }

  /**
   * Left at the CM6 default of true: the editor ignores events on the widget,
   * so the badge's own click listener fires natively. Returning false hands the
   * event to CM's input handling instead and the badge never reacts.
   */
  ignoreEvent(): boolean {
    return true;
  }
}

const buildBadgeDecorations = (
  view: EditorView,
  plugin: DiscourseGraphPlugin,
): DecorationSet => {
  if (!plugin.settings.showDiscourseContextOverlay) return Decoration.none;
  // Source mode shows raw markdown; a badge there would be noise.
  if (!view.state.field(editorLivePreviewField, false)) return Decoration.none;

  const sourcePath = view.state.field(editorInfoField, false)?.file?.path;
  if (!sourcePath) return Decoration.none;

  const widgets = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let match: RegExpExecArray | null;
    INTERNAL_LINK_RE.lastIndex = 0;

    while ((match = INTERNAL_LINK_RE.exec(text)) !== null) {
      const checkPos = from + match.index - 1;
      const isEmbed =
        checkPos >= 0 &&
        view.state.doc.sliceString(checkPos, checkPos + 1) === "!";
      if (isEmbed) continue;

      const target = resolveDiscourseLinkTarget({
        plugin,
        linktext: extractLinktext(match[0]),
        sourcePath,
      });
      if (!target) continue;

      const matchEnd = from + match.index + match[0].length;
      widgets.push(
        Decoration.widget({
          widget: new DiscourseContextBadgeWidget(target, plugin),
          side: 1,
        }).range(matchEnd),
      );
    }
  }

  widgets.sort((a, b) => a.from - b.from);
  return Decoration.set(widgets);
};

/**
 * Renders the discourse context badge after each link to a discourse node in
 * Live Preview.
 *
 * Rebuilds on relation changes as well as document and viewport changes, since
 * the badge shows a count that lives outside the document — adding a relation
 * from the badge's own popover has to update the number behind it.
 */
export const createDiscourseContextOverlayExtension = (
  plugin: DiscourseGraphPlugin,
): ViewPlugin<PluginValue> =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private enabled: boolean;
      private unsubscribe: () => void;

      constructor(view: EditorView) {
        this.enabled = plugin.settings.showDiscourseContextOverlay;
        this.decorations = buildBadgeDecorations(view, plugin);
        this.unsubscribe = plugin.relationsIndex.onChange(() => {
          this.decorations = buildBadgeDecorations(view, plugin);
          // The index resolves outside any transaction, so ask for a redraw.
          view.dispatch({});
        });
      }

      update(update: ViewUpdate): void {
        // The setting is toggled by dispatching an empty transaction, which
        // changes neither the document nor the viewport, so it has to be
        // compared explicitly or the toggle would appear to do nothing.
        const enabled = plugin.settings.showDiscourseContextOverlay;
        if (
          !update.docChanged &&
          !update.viewportChanged &&
          enabled === this.enabled
        ) {
          return;
        }
        this.enabled = enabled;
        this.decorations = buildBadgeDecorations(update.view, plugin);
      }

      destroy(): void {
        this.unsubscribe();
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );
