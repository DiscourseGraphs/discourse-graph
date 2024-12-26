import { remark } from "remark";
import html from "remark-html";
import { notFound } from "next/navigation";
import path from "path";
import fs from "fs/promises";
import matter from "gray-matter";
import { BlogSchema, type Blog, BlogFrontmatter } from "./schema";

const BLOG_DIRECTORY = path.join(process.cwd(), "app/blog/posts");

// Utility to check if blog directory exists
async function validateBlogDirectory(): Promise<boolean> {
  try {
    const stats = await fs.stat(BLOG_DIRECTORY);
    return stats.isDirectory();
  } catch {
    console.log("No app/blog/posts directory found.");
    return false;
  }
}

// Utility to process a single blog file
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

// Utility to get markdown content as HTML
async function getMarkdownContent(content: string): Promise<string> {
  const processedContent = await remark().use(html).process(content);
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

    return blogs.filter(Boolean) as Blog[];
  } catch (error) {
    console.error("Error reading blog directory:", error);
    return [];
  }
}

export async function getBlog(
  slug: string,
): Promise<{ data: BlogFrontmatter; contentHtml: string }> {
  try {
    const filePath = path.join(BLOG_DIRECTORY, `${slug}.md`);
    await fs.access(filePath);

    const fileContent = await fs.readFile(filePath, "utf-8");
    const { data: rawData, content } = matter(fileContent);
    const data = BlogSchema.parse(rawData);
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
