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
  const fileContent = await getFileContent({
    filename,
    directory,
  });
  const { data } = matter(fileContent);
  return PageSchema.parse(data);
};
