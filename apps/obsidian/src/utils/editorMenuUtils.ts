import { App, MarkdownView, Menu, TFile } from "obsidian";
import { DiscourseNode } from "~/types";

/**
 * Add a "Convert into" / "Turn into discourse node" submenu to a context menu,
 * with one item per node type.
 */
export const addConvertSubmenu = ({
  menu,
  label,
  nodeTypes,
  onClick,
}: {
  menu: Menu;
  label: string;
  nodeTypes: DiscourseNode[];
  onClick: (nodeType: DiscourseNode) => void | Promise<void>;
}): void => {
  menu.addItem((menuItem) => {
    menuItem.setTitle(label);
    menuItem.setIcon("file-type");

    const submenu = menuItem.setSubmenu();

    nodeTypes.forEach((nodeType) => {
      submenu.addItem((item) => {
        item
          .setTitle(nodeType.name)
          .setIcon("file-type")
          .onClick(() => void onClick(nodeType));
      });
    });
  });
};

/**
 * Replace the first embed of `imageFile` in the active editor with a link to `targetFile`.
 */
export const replaceImageEmbedInEditor = ({
  app,
  imageFile,
  targetFile,
}: {
  app: App;
  imageFile: TFile;
  targetFile: TFile;
}): void => {
  const activeView = app.workspace.getActiveViewOfType(MarkdownView);
  if (!activeView?.file) return;

  const cache = app.metadataCache.getFileCache(activeView.file);
  const embed = cache?.embeds?.find((e) => {
    const resolved = app.metadataCache.getFirstLinkpathDest(
      e.link,
      activeView.file!.path,
    );
    return resolved?.path === imageFile.path;
  });
  if (!embed) return;

  const from = activeView.editor.offsetToPos(embed.position.start.offset);
  const to = activeView.editor.offsetToPos(embed.position.end.offset);
  const linkText = app.metadataCache.fileToLinktext(
    targetFile,
    activeView.file.path,
  );
  activeView.editor.replaceRange(`[[${linkText}]]`, from, to);
};

const IMAGE_EXTENSIONS = /^(png|jpe?g|gif|svg|bmp|webp|avif|tiff?)$/i;

export const isImageFile = (file: TFile): boolean =>
  IMAGE_EXTENSIONS.test(file.extension);
