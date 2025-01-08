import { getHtmlFromMarkdown } from "~/utils/getHtmlFromMarkdown";
import { getFileContent } from "~/utils/getFileContent";
import { notFound } from "next/navigation";
import { BlogFrontmatter, BlogSchema } from "~/(home)/blog/schema";
import matter from "gray-matter";

type Props = {
  slug: string;
  directory: string;
};

type ProcessedMarkdownPage = {
  data: BlogFrontmatter;
  contentHtml: string;
};

export const getMarkdownPage = async ({
  slug,
  directory,
}: Props): Promise<ProcessedMarkdownPage> => {
  try {
    const fileContent = await getFileContent({
      filename: `${slug}.md`,
      directory,
    });
    const { data: rawData, content } = matter(fileContent);
    const data = BlogSchema.parse(rawData);

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
