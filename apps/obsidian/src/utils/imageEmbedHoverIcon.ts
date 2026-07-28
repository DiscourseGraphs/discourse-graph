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
  // A plain div, matching how Obsidian itself builds native embed-action
  // buttons (see the app's own `createDiv("embed-action")`). A real
  // <button> would pick up Obsidian's global unscoped `button` reset
  // (fixed input height/padding/background) on top of ".embed-action",
  // inflating the shared pill and painting over the icon.
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

  const embeds = container.querySelectorAll<HTMLElement>(
    ".internal-embed.image-embed",
  );

  for (const embedEl of embeds) {
    // Skip if button already exists to prevent duplicates when processContainer
    // is called multiple times (constructor, MutationObserver, update()).
    if (embedEl.querySelector(`.${ICON_CLASS}`)) continue;

    const imageFile = resolveImageFile(embedEl, plugin);
    if (!imageFile) continue;

    const btn = createConvertIcon(embedEl, plugin);
    // Obsidian 1.13+ groups its own image-embed buttons in a shared
    // ".embed-actions" pill that reveals on hover/selection. Join that
    // group so ours lays out alongside native buttons and inherits the
    // same reveal behavior, instead of overlapping a hardcoded pixel
    // offset. Fall back to a plain sibling for older Obsidian versions
    // without that wrapper.
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
