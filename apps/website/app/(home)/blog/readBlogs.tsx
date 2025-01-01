import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import { notFound } from "next/navigation";
import path from "path";
import fs from "fs/promises";
import matter from "gray-matter";
import { BlogSchema, type Blog, BlogFrontmatter } from "./schema";

const BLOG_DIRECTORY = path.join(process.cwd(), "app/(home)/blog/posts");

async function validateBlogDirectory(): Promise<boolean> {
  try {
    const stats = await fs.stat(BLOG_DIRECTORY);
    return stats.isDirectory();
  } catch {
    console.log("No app/blog/posts directory found.");
    return false;
  }
}

async function processBlogFile(filename: string): Promise<Blog | null> {
  try {
    const filePath = path.join(BLOG_DIRECTORY, filename);
    const fileContent = await fs.readFile(filePath, "utf-8");
    const { data } = matter(fileContent);
    const validatedData = BlogSchema.parse(data);

    return {
      slug: filename.replace(/\.md$/, ""),
      ...validatedData,
    };
  } catch (error) {
    console.error(`Error processing blog file ${filename}:`, error);
    return null;
  }
}

function remarkHeadingId() {
  return (tree: any) => {
    visit(tree, "heading", (node) => {
      const text = toString(node);
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      node.data = {
        hName: `h${node.depth}`,
        hProperties: { id },
      };
    });
  };
}

async function getMarkdownContent(content: string): Promise<string> {
  const processedContent = await unified()
    .use(remarkParse)
    .use(remarkHeadingId)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(content);
  console.log(processedContent.toString());
  return processedContent.toString();
}

export async function getAllBlogs(): Promise<Blog[]> {
  try {
    const directoryExists = await validateBlogDirectory();
    if (!directoryExists) return [];

    const files = await fs.readdir(BLOG_DIRECTORY);
    const blogs = await Promise.all(
      files.filter((filename) => filename.endsWith(".md")).map(processBlogFile),
    );
    const validBlogs = blogs.filter(Boolean) as Blog[];
    return validBlogs.filter((blog) => blog.published);
  } catch (error) {
    console.error("Error reading blog directory:", error);
    return [];
  }
}

export async function getFileContent(
  filename: string,
  directory: string,
): Promise<string> {
  const filePath = path.join(directory, filename);
  const fileContent = await fs.readFile(filePath, "utf-8");
  return fileContent;
}

export async function getBlog(
  slug: string,
  directory: string = BLOG_DIRECTORY,
): Promise<{ data: BlogFrontmatter; contentHtml: string }> {
  try {
    const filePath = path.join(directory, `${slug}.md`);
    await fs.access(filePath);

    const fileContent = await fs.readFile(filePath, "utf-8");
    const { data: rawData, content } = matter(fileContent);
    const data = BlogSchema.parse(rawData);

    if (!data.published) {
      console.log(`Post ${slug} is not published`);
      return notFound();
    }

    const contentHtml = await getMarkdownContent(content);

    return { data, contentHtml };
  } catch (error) {
    console.error("Error loading blog post:", error);
    return notFound();
  }
}

export async function getLatestBlogs(): Promise<Blog[]> {
  const blogs = await getAllBlogs();
  return blogs
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);
}
