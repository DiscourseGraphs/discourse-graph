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
    const appendLinkToFrontmatter = async (file: TFile, link: string) => {
      await app.fileManager.processFrontMatter(file, (fm: FrontMatterCache) => {
        const existingLinks = Array.isArray(fm[relationType.id])
          ? (fm[relationType.id] as string[])
          : [];

        // Check if the link already exists to avoid duplicates
        const linkToAdd = `[[${link}]]`;
        if (!existingLinks.includes(linkToAdd)) {
          fm[relationType.id] = [...existingLinks, linkToAdd];
        }
      });
    };

    // Add bidirectional links
    await appendLinkToFrontmatter(sourceFile, targetFile.basename);
    await appendLinkToFrontmatter(targetFile, sourceFile.basename);
  } catch (error) {
    console.error("Failed to add relation to frontmatter:", error);
    throw error;
  }
};
