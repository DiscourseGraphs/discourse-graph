import { getHtmlFromMarkdown } from "~/utils/getHtmlFromMarkdown";
import { getFileContent } from "~/utils/getFileContent";
import { notFound } from "next/navigation";
import { PageFrontmatter, PageSchema } from "~/types/schema";
import matter from "gray-matter";

type Props = {
  slug: string;
  directory: string;
};

type ProcessedMarkdownPage = {
  data: PageFrontmatter;
  contentHtml: string;
};

export const getProcessedMarkdownFile = async ({
  slug,
  directory,
}: Props): Promise<ProcessedMarkdownPage> => {
  try {
    if (!slug || !directory) {
      throw new Error("Both slug and directory are required");
    }

    // Prevent directory traversal
    if (slug.includes("..") || directory.includes("..")) {
      throw new Error("Invalid path");
    }

    const fileContent = await getFileContent({
      filename: `${slug}.md`,
      directory,
    });
    const { data: rawData, content } = matter(fileContent);
    const data = PageSchema.parse(rawData);

    if (!data.published) {
      console.log(`Post ${slug} is not published`);
      return notFound();
    }

    const contentHtml = await getHtmlFromMarkdown(content);

    return { data, contentHtml };
  } catch (error) {
    console.error("Error loading blog post:", error);
    return notFound();
  }
};
