import type { App, FrontMatterCache, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";

/**
 * Adds bidirectional relation links to the frontmatter of both files.
 * This follows the same pattern as RelationshipSection.tsx
 */
export const addRelationToFrontmatter = async ({
  app,
  plugin,
  sourceFile,
  targetFile,
  relationTypeId,
}: {
  app: App;
  plugin: DiscourseGraphPlugin;
  sourceFile: TFile;
  targetFile: TFile;
  relationTypeId: string;
}): Promise<void> => {
  const relationType = plugin.settings.relationTypes.find(
    (r) => r.id === relationTypeId,
  );

  if (!relationType) {
    console.error(`Relation type ${relationTypeId} not found`);
    return;
  }

  try {
    const appendLinkToFrontmatter = async (
      fileToMutate: TFile,
      targetFile: TFile,
    ) => {
      await app.fileManager.processFrontMatter(
        fileToMutate,
        (fm: FrontMatterCache) => {
          const existingLinks = Array.isArray(fm[relationType.id])
            ? (fm[relationType.id] as string[])
            : [];

          const linkText = app.metadataCache.fileToLinktext(
            targetFile,
            fileToMutate.path,
          );
          const linkToAdd = `[[${linkText}]]`;

          const normalizeLink = (link: string) => {
            const cleanLink = link.replace(/^\[\[|\]\]$/g, "");
            try {
              const file = app.metadataCache.getFirstLinkpathDest(
                cleanLink,
                fileToMutate.path,
              );
              if (file) {
                return app.metadataCache.fileToLinktext(
                  file,
                  fileToMutate.path,
                );
              }
            } catch {
              return cleanLink;
            }
            return cleanLink;
          };

          const normalizedExistingLinks = existingLinks.map(normalizeLink);
          const normalizedLinkToAdd = normalizeLink(linkToAdd);

          if (!normalizedExistingLinks.includes(normalizedLinkToAdd)) {
            fm[relationType.id] = [...existingLinks, linkToAdd];
          }
        },
      );
    };

    await appendLinkToFrontmatter(sourceFile, targetFile);
    await appendLinkToFrontmatter(targetFile, sourceFile);
  } catch (error) {
    console.error("Failed to add relation to frontmatter:", error);
    throw error;
  }
};
