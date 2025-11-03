import type { App, TFile } from "obsidian";

export type FrontmatterRecord = Record<string, unknown>;

export const getFrontmatterForFile = (
  app: App,
  file: TFile,
): FrontmatterRecord | null => {
  return (app.metadataCache.getFileCache(file)?.frontmatter ??
    null) as FrontmatterRecord | null;
};

export const getNodeTypeIdFromFrontmatter = (
  frontmatter: FrontmatterRecord | null,
): string | null => {
  if (!frontmatter) return null;
  return (frontmatter as { nodeTypeId?: string })?.nodeTypeId ?? null;
};

// Extracts the first image reference from a file in document order.
// Supports both internal vault embeds/links and external URLs.
export const getFirstImageSrcForFile = async (
  app: App,
  file: TFile,
): Promise<string | null> => {
  try {
    const content = await app.vault.cachedRead(file);

    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)|!\[\[([^\]]+)\]\]/g;
    let match;
    const normalizeLinkTarget = (s: string) => {
      // Strip optional markdown title: ![alt](url "title")
      const withoutTitle = s.replace(/\s+"[^"]*"\s*$/, "");
      // Unwrap angle brackets: ![alt](<path with spaces>)
      const unwrapped = withoutTitle.replace(/^<(.+)>$/, "$1");
      // Drop Obsidian alias and header fragments
      return unwrapped.split("|")?.[0]?.split("#")?.[0]?.trim();
    };

    while ((match = imageRegex.exec(content)) !== null) {
      if (match[2]) {
        const target = match[2].trim();

        // External URL - return directly
        if (/^https?:\/\//i.test(target)) {
          return target;
        }

        // Internal path - resolve to vault file
        const normalized = normalizeLinkTarget(target);
        const tfile = app.metadataCache.getFirstLinkpathDest(
          normalized ?? target,
          file.path,
        );
        if (
          tfile &&
          /^(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i.test(tfile.extension)
        ) {
          return app.vault.getResourcePath(tfile);
        }
      } else if (match[3]) {
        // Wiki-style embed: ![[path]]
        const target = match[3].trim();
        const normalized = normalizeLinkTarget(target);
        const tfile = app.metadataCache.getFirstLinkpathDest(
          normalized ?? target,
          file.path,
        );
        if (
          tfile &&
          /^(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i.test(tfile.extension)
        ) {
          return app.vault.getResourcePath(tfile);
        }
      }
    }
  } catch (e) {
    console.warn("getFirstImageSrcForFile: failed to extract image", e);
  }
  return null;
};
