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
import {
  createDiscourseContextBadge,
  updateDiscourseContextBadge,
} from "~/components/discourseContextBadge";
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

  /** Keyed on what the badge displays, so keystrokes elsewhere do not rebuild it. */
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
   * Updates in place so a popover anchored to this badge keeps a connected
   * anchor; without this CM6 replaces the element on every count change.
   */
  updateDOM(dom: HTMLElement): boolean {
    updateDiscourseContextBadge({
      badge: dom,
      nodeType: this.target.nodeType,
      relationCount: this.target.relationCount,
    });
    return true;
  }

  /** True (the CM6 default) means the editor ignores the event, so our click handler runs. */
  ignoreEvent(): boolean {
    return true;
  }
}

const buildBadgeDecorations = (
  view: EditorView,
  plugin: DiscourseGraphPlugin,
): DecorationSet => {
  if (!plugin.settings.showDiscourseContextOverlay) return Decoration.none;
  // Source mode shows raw markdown; a badge there is noise.
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

export const createDiscourseContextOverlayExtension = (
  plugin: DiscourseGraphPlugin,
): ViewPlugin<PluginValue> =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private enabled: boolean;
      private indexVersion: number;

      constructor(view: EditorView) {
        this.enabled = plugin.settings.showDiscourseContextOverlay;
        this.indexVersion = plugin.relationsIndex.getVersion();
        this.decorations = buildBadgeDecorations(view, plugin);
      }

      update(update: ViewUpdate): void {
        // Setting and relation changes arrive as an empty transaction, which
        // changes neither doc nor viewport, so both need comparing explicitly.
        const enabled = plugin.settings.showDiscourseContextOverlay;
        const indexVersion = plugin.relationsIndex.getVersion();
        if (
          !update.docChanged &&
          !update.viewportChanged &&
          enabled === this.enabled &&
          indexVersion === this.indexVersion
        ) {
          return;
        }
        this.enabled = enabled;
        this.indexVersion = indexVersion;
        this.decorations = buildBadgeDecorations(update.view, plugin);
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );
