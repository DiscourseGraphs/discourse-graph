import {
  type PluginValue,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  Decoration,
  type DecorationSet,
  EditorView,
} from "@codemirror/view";
import { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";

const buildObsidianUrl = (vaultName: string, filePath: string): string => {
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
};

const resolveFileFromLinkText = (
  linkText: string,
  plugin: DiscourseGraphPlugin,
): TFile | null => {
  const activeFile = plugin.app.workspace.getActiveFile();
  if (!activeFile) return null;

  const resolved = plugin.app.metadataCache.getFirstLinkpathDest(
    linkText,
    activeFile.path,
  );
  return resolved instanceof TFile ? resolved : null;
};

const setDragData = (
  e: DragEvent,
  file: TFile,
  plugin: DiscourseGraphPlugin,
): void => {
  const vaultName = plugin.app.vault.getName();
  const url = buildObsidianUrl(vaultName, file.path);
  e.dataTransfer?.setData("text/uri-list", url);
  e.dataTransfer?.setData("text/plain", url);
};

// --- Live Preview ---

/**
 * Extract the file path from a link match.
 * Handles wikilinks (`[[path]]`, `[[path|alias]]`) and
 * markdown links (`[text](path.md)`), decoding URL-encoded paths.
 */
const extractLinkPath = (match: string): string => {
  // Wikilink: [[path]] or [[path|alias]]
  if (match.startsWith("[[")) {
    const inner = match.slice(2, -2);
    const pipeIndex = inner.indexOf("|");
    return pipeIndex >= 0 ? inner.slice(0, pipeIndex) : inner;
  }

  // Markdown link: [text](path)
  const parenOpen = match.lastIndexOf("(");
  const rawPath = match.slice(parenOpen + 1, -1);
  try {
    return decodeURIComponent(rawPath);
  } catch (error) {
    return rawPath;
  }
};

/**
 * Widget that renders a small drag handle next to an internal link.
 * CM6 widgets get `ignoreEvent() → true` by default, which means
 * the editor completely ignores mouse events on them — native drag works.
 */
class WikilinkDragHandleWidget extends WidgetType {
  constructor(
    private linkPath: string,
    private plugin: DiscourseGraphPlugin,
  ) {
    super();
  }

  eq(other: WikilinkDragHandleWidget): boolean {
    return this.linkPath === other.linkPath;
  }

  toDOM(): HTMLElement {
    const handle = document.createElement("span");
    handle.className =
      "inline-block cursor-grab opacity-30 text-[10px] text-[var(--text-muted)] align-middle ml-0.5 transition-opacity duration-150 ease-in-out select-none";
    handle.draggable = true;
    handle.setAttribute("aria-label", "Drag to canvas");
    handle.textContent = "⠿";

    handle.addEventListener("mouseenter", () => {
      handle.style.opacity = "1";
    });
    handle.addEventListener("mouseleave", () => {
      handle.style.opacity = "";
    });

    handle.addEventListener("dragstart", (e) => {
      const file = resolveFileFromLinkText(this.linkPath, this.plugin);
      if (!file) {
        e.preventDefault();
        return;
      }
      setDragData(e, file, this.plugin);
    });

    return handle;
  }
}

// Matches wikilinks [[...]] and markdown links [text](path.md).
// Embed exclusion (![[...]] and ![text](...)) is handled in the loop.
const INTERNAL_LINK_RE = /\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+\.md)\)/g;

const buildWidgetDecorations = (
  view: EditorView,
  plugin: DiscourseGraphPlugin,
): DecorationSet => {
  const widgets = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let match: RegExpExecArray | null;
    INTERNAL_LINK_RE.lastIndex = 0;

    while ((match = INTERNAL_LINK_RE.exec(text)) !== null) {
      let isEmbed = false;
      const checkPos = from + match.index - 1;
      const isEmbed = checkPos >= 0 && view.state.doc.sliceString(checkPos, checkPos + 1) === "!";
      if (isEmbed) continue;
      const matchEnd = from + match.index + match[0].length;
      const linkPath = extractLinkPath(match[0]);
      const widget = new WikilinkDragHandleWidget(linkPath, plugin);
      widgets.push(Decoration.widget({ widget, side: 1 }).range(matchEnd));
    }
  }

  // Decorations must be sorted by position
  widgets.sort((a, b) => a.from - b.from);
  return Decoration.set(widgets);
};

/**
 * CM6 ViewPlugin that adds a draggable grip icon after each internal link
 * in Live Preview. Matches both wikilinks (`[[...]]`) and markdown links
 * (`[text](path.md)`), inserting a widget decoration after each match.
 */
export const createWikilinkDragExtension = (
  plugin: DiscourseGraphPlugin,
): ViewPlugin<PluginValue> => {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildWidgetDecorations(view, plugin);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildWidgetDecorations(update.view, plugin);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );
};
