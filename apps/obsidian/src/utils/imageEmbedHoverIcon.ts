import {
  type PluginValue,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { setIcon, setTooltip, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import {
  isImageFile,
  openConvertImageToNodeModal,
} from "~/utils/editorMenuUtils";

const ICON_CLASS = "dg-image-convert-icon";

const resolveImageFile = (
  embedEl: HTMLElement,
  plugin: DiscourseGraphPlugin,
): TFile | null => {
  const src = embedEl.getAttribute("src");
  if (!src) return null;

  const activeFile = plugin.app.workspace.getActiveFile();
  if (!activeFile) return null;

  const resolved = plugin.app.metadataCache.getFirstLinkpathDest(
    src,
    activeFile.path,
  );
  if (!resolved || !isImageFile(resolved)) return null;

  return resolved;
};

const createConvertIcon = (
  embedEl: HTMLElement,
  plugin: DiscourseGraphPlugin,
): HTMLDivElement => {
  // A div, not a button, to match Obsidian's own embed-action markup.
  const btn = createEl("div");
  btn.className = `${ICON_CLASS} embed-action flex items-center justify-center`;
  btn.setAttribute("role", "button");
  btn.tabIndex = 0;
  setIcon(btn, "file-input");
  setTooltip(btn, "Convert to node");

  // Prevent mousedown from bubbling to Obsidian's embed selection handler
  btn.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  const convert = () => {
    const imageFile = resolveImageFile(embedEl, plugin);
    if (!imageFile) return;

    openConvertImageToNodeModal({ plugin, imageFile });
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    convert();
  });

  btn.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.stopPropagation();
    e.preventDefault();
    convert();
  });

  return btn;
};

const processContainer = (
  container: HTMLElement,
  plugin: DiscourseGraphPlugin,
): void => {
  const embeds = container.querySelectorAll<HTMLElement>(
    ".internal-embed.image-embed",
  );

  for (const embedEl of embeds) {
    // Skip embeds that already have the button (processContainer runs repeatedly).
    if (embedEl.querySelector(`.${ICON_CLASS}`)) continue;

    const imageFile = resolveImageFile(embedEl, plugin);
    if (!imageFile) continue;

    const btn = createConvertIcon(embedEl, plugin);
    // Join Obsidian's native embed-actions group when present, so ours lays
    // out alongside native buttons instead of a hardcoded pixel offset.
    const actionsEl = embedEl.querySelector<HTMLElement>(".embed-actions");
    if (actionsEl) {
      actionsEl.prepend(btn);
    } else {
      embedEl.classList.add("relative");
      embedEl.appendChild(btn);
    }
  }
};

/**
 * CodeMirror ViewPlugin that adds a "Convert to node" icon on embedded images
 * in the live-preview editor. Reveal timing (hover/selection) matches
 * Obsidian's native embed action buttons via CSS.
 */
export const createImageEmbedHoverExtension = (
  plugin: DiscourseGraphPlugin,
): ViewPlugin<PluginValue> => {
  return ViewPlugin.fromClass(
    class {
      private dom: HTMLElement;
      private observer: MutationObserver;

      constructor(view: EditorView) {
        this.dom = view.dom;
        processContainer(view.dom, plugin);

        // Obsidian renders embeds asynchronously after doc changes,
        // so we need a MutationObserver to catch newly added image embeds.
        this.observer = new MutationObserver((mutations) => {
          const hasRelevantMutation = mutations.some((m) =>
            Array.from(m.addedNodes).some(
              (n) =>
                n instanceof HTMLElement &&
                !n.classList.contains(ICON_CLASS) &&
                (n.matches(".internal-embed.image-embed") ||
                  n.querySelector(".internal-embed.image-embed")),
            ),
          );
          if (hasRelevantMutation) {
            processContainer(this.dom, plugin);
          }
        });
        this.observer.observe(this.dom, {
          childList: true,
          subtree: true,
        });
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          processContainer(update.view.dom, plugin);
        }
      }

      destroy(): void {
        this.observer.disconnect();
        const icons = this.dom.querySelectorAll(`.${ICON_CLASS}`);
        icons.forEach((icon) => icon.remove());
      }
    },
  );
};
