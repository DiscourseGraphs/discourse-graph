import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { setIcon, TFile } from "obsidian";
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
): HTMLButtonElement => {
  const btn = document.createElement("button");
  btn.className = `${ICON_CLASS} absolute z-[2] right-[42px] w-[26px] h-[26px] flex cursor-[var(--cursor)] border-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto`;
  btn.style.cssText = `
    top: var(--size-2-2);
    padding: var(--size-2-2) var(--size-2-3);
    color: var(--text-muted);
    background-color: var(--background-primary);
  `;
  btn.title = "Convert to node";
  setIcon(btn, "file-input");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    const imageFile = resolveImageFile(embedEl, plugin);
    if (!imageFile) return;

    openConvertImageToNodeModal({ plugin, imageFile });
  });

  return btn;
};

const processContainer = (
  container: HTMLElement,
  plugin: DiscourseGraphPlugin,
) => {
  const embeds = container.querySelectorAll<HTMLElement>(
    ".internal-embed.image-embed",
  );

  for (const embedEl of embeds) {
    if (embedEl.querySelector(`.${ICON_CLASS}`)) continue;

    const imageFile = resolveImageFile(embedEl, plugin);
    if (!imageFile) continue;

    embedEl.classList.add("group", "relative");
    embedEl.appendChild(createConvertIcon(embedEl, plugin));
  }
};

/**
 * CodeMirror ViewPlugin that adds a "Convert to node" hover icon
 * on embedded images in the live-preview editor.
 */
export const createImageEmbedHoverExtension = (
  plugin: DiscourseGraphPlugin,
) => {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        processContainer(view.dom, plugin);
      }

      update(_update: ViewUpdate) {
        processContainer(_update.view.dom, plugin);
      }
    },
  );
};
