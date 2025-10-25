import type { App, FrontMatterCache, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";

/**
 * Adds bidirectional relation links to the frontmatter of both files.
 * This follows the same pattern as RelationshipSection.tsx
 * 
 * @returns Object indicating whether the relation already existed
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
}): Promise<{ alreadyExisted: boolean }> => {
  const relationType = plugin.settings.relationTypes.find(
    (r) => r.id === relationTypeId,
  );

  if (!relationType) {
    console.error(`Relation type ${relationTypeId} not found`);
    return { alreadyExisted: false };
  }

  try {
    let sourceToTargetExisted = false;
    let targetToSourceExisted = false;

    const appendLinkToFrontmatter = async (
      fileToMutate: TFile,
      targetFile: TFile,
    ): Promise<boolean> => {
      let linkAlreadyExists = false;

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
            linkAlreadyExists = false;
          } else {
            linkAlreadyExists = true;
          }
        },
      );

      return linkAlreadyExists;
    };

    sourceToTargetExisted = await appendLinkToFrontmatter(
      sourceFile,
      targetFile,
    );
    targetToSourceExisted = await appendLinkToFrontmatter(
      targetFile,
      sourceFile,
    );

    // Consider the relation as "already existed" if both directions existed
    return { alreadyExisted: sourceToTargetExisted && targetToSourceExisted };
  } catch (error) {
    console.error("Failed to add relation to frontmatter:", error);
    throw error;
  }
};
