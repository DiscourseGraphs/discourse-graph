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
import { extractLinktext, INTERNAL_LINK_RE } from "./internalLinkParsing";

class DiscourseContextBadgeWidget extends WidgetType {
  constructor(
    private target: DiscourseLinkTarget,
    private plugin: DiscourseGraphPlugin,
  ) {
    super();
  }

  /**
   * Keyed on everything the badge displays, so it is rebuilt when its content
   * changes and left alone on every other keystroke in the document.
   */
  eq(other: DiscourseContextBadgeWidget): boolean {
    return (
      this.target.file.path === other.target.file.path &&
      this.target.relationCount === other.target.relationCount &&
      this.target.nodeType.id === other.target.nodeType.id &&
      this.target.nodeType.name === other.target.nodeType.name
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

  return Decoration.set(widgets, true);
};

/**
 * Renders the discourse context badge after each link to a discourse node in
 * Live Preview.
 *
 * Rebuilds on document and viewport changes. Changes that originate outside the
 * document — a relation added, a target's frontmatter finishing indexing —
 * arrive as an empty transaction from registerDiscourseContextOverlayRefresh.
 */
export const createDiscourseContextOverlayExtension = (
  plugin: DiscourseGraphPlugin,
): ViewPlugin<PluginValue> =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private enabled: boolean;

      constructor(view: EditorView) {
        this.enabled = plugin.settings.showDiscourseContextOverlay;
        this.decorations = buildBadgeDecorations(view, plugin);
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
    },
    {
      decorations: (v) => v.decorations,
    },
  );
