import matter from "gray-matter";
import { PageFrontmatter, PageSchema } from "~/types/schema";
import { getFileContent } from "~/utils/getFileContent";

type Props = {
  filename: string;
  directory: string;
};

export const getFileMetadata = async ({
  filename,
  directory,
}: Props): Promise<PageFrontmatter> => {
  try {
    const fileContent = await getFileContent({
      filename,
      directory,
    });
    const { data } = matter(fileContent);
    return PageSchema.parse(data);
  } catch (error) {
    console.error(`Error parsing metadata for ${filename}:`, error);
    throw new Error(
      `Invalid frontmatter in ${filename}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
};
