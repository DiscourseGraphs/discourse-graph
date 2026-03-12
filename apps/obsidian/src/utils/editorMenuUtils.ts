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
}) => {
  menu.addItem((menuItem) => {
    menuItem.setTitle(label);
    menuItem.setIcon("file-type");

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment*/
    // @ts-expect-error - setSubmenu is not officially in the API but works
    const submenu = menuItem.setSubmenu();

    nodeTypes.forEach((nodeType) => {
      // setSubmenu is not officially in the API but works
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      submenu.addItem((item: any) => {
        item
          .setTitle(nodeType.name)
          .setIcon("file-type")
          .onClick(() => void onClick(nodeType));
      });
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    });
  });
};

/**
 * Replace the first embed of `imageFile` in the active editor with a link to `targetFile`.
 */
export const replaceImageEmbedInEditor = (
  app: App,
  imageFile: TFile,
  targetFile: TFile,
) => {
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
  activeView.editor.replaceRange(`[[${targetFile.basename}]]`, from, to);
};

const IMAGE_EXTENSIONS = /^(png|jpe?g|gif|svg|bmp|webp|avif|tiff?)$/i;

export const isImageFile = (file: TFile): boolean =>
  IMAGE_EXTENSIONS.test(file.extension);

/**
 * Returns true when `selection` looks like a single image embed
 * (wikilink, markdown, or HTML img tag).
 */
export const isImageEmbed = (selection: string): boolean => {
  // Wikilink embed: ![[image.png]] or ![[image.png|500]]
  if (/^!\[\[[^\]]+\]\]$/.test(selection)) return true;
  // Markdown image: ![alt](path) or ![alt](path "title")
  if (/^!\[[^\]]*\]\([^)]+\)$/.test(selection)) return true;
  // HTML img tag: <img src="path" ...>
  if (/^<img\s[^>]*src=["'][^"']+["'][^>]*\/?>$/i.test(selection)) return true;
  return false;
};
