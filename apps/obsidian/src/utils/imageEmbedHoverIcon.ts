import {
  type PluginValue,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { setIcon, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import {
  isImageFile,
  openConvertImageToNodeModal,
} from "~/utils/editorMenuUtils";

const ICON_CLASS = "dg-image-convert-icon";
const EMBED_ACTIVE_CLASS = "dg-image-embed-active";

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
): HTMLButtonElement => {
  const btn = document.createElement("button");
  btn.className = `${ICON_CLASS} absolute z-[2] right-[42px] h-[28px] w-[28px] flex border-none opacity-0 pointer-events-none`;
  btn.title = "Convert to node";
  setIcon(btn, "file-input");

  // Prevent mousedown from bubbling to the embed's mousedown handler
  btn.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    const imageFile = resolveImageFile(embedEl, plugin);
    if (!imageFile) return;

    openConvertImageToNodeModal({ plugin, imageFile });
  });

  return btn;
};

const showButtonForEmbed = (embedEl: HTMLElement): void => {
  embedEl.classList.add(EMBED_ACTIVE_CLASS);
};

const hideButtonForEmbed = (embedEl: HTMLElement): void => {
  embedEl.classList.remove(EMBED_ACTIVE_CLASS);
};

const processContainer = (
  container: HTMLElement,
  plugin: DiscourseGraphPlugin,
): void => {
  const embeds = container.querySelectorAll<HTMLElement>(
    ".internal-embed.image-embed",
  );

  for (const embedEl of embeds) {
    if (embedEl.querySelector(`.${ICON_CLASS}`)) continue;

    const imageFile = resolveImageFile(embedEl, plugin);
    if (!imageFile) continue;

    embedEl.classList.add("relative");
    embedEl.appendChild(createConvertIcon(embedEl, plugin));

    // Use mousedown to match the timing of Obsidian's native "edit this block" button
    embedEl.addEventListener("mousedown", (e) => {
      e.stopPropagation();

      // Hide any other active embed in the container first
      container
        .querySelectorAll<HTMLElement>(`.${EMBED_ACTIVE_CLASS}`)
        .forEach(hideButtonForEmbed);

      showButtonForEmbed(embedEl);
    });
  }
};

/**
 * CodeMirror ViewPlugin that adds a "Convert to node" icon on embedded images
 * in the live-preview editor. The button appears on click (matching the behavior
 * of Obsidian's native "edit this block" button) rather than on hover.
 */
export const createImageEmbedHoverExtension = (
  plugin: DiscourseGraphPlugin,
): ViewPlugin<PluginValue> => {
  return ViewPlugin.fromClass(
    class {
      private dom: HTMLElement;
      private observer: MutationObserver;
      private handleOutsideClick: () => void;

      constructor(view: EditorView) {
        this.dom = view.dom;
        processContainer(view.dom, plugin);

        this.handleOutsideClick = () => {
          this.dom
            .querySelectorAll<HTMLElement>(`.${EMBED_ACTIVE_CLASS}`)
            .forEach(hideButtonForEmbed);
        };
        document.addEventListener("mousedown", this.handleOutsideClick);

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
        document.removeEventListener("mousedown", this.handleOutsideClick);
        const icons = this.dom.querySelectorAll(`.${ICON_CLASS}`);
        icons.forEach((icon) => icon.remove());
      }
    },
  );
};
