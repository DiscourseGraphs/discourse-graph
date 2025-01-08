import path from "path";
import fs from "fs/promises";
import matter from "gray-matter";
import { BLOG_PATH } from "~/data/constants";
import { PageSchema, type PageData } from "~/types/schema";

const BLOG_DIRECTORY = path.join(process.cwd(), BLOG_PATH);

async function validateBlogDirectory(): Promise<boolean> {
  try {
    const stats = await fs.stat(BLOG_DIRECTORY);
    return stats.isDirectory();
  } catch {
    console.log("No app/blog/posts directory found.");
    return false;
  }
}

async function processBlogFile(filename: string): Promise<PageData | null> {
  try {
    const filePath = path.resolve(BLOG_DIRECTORY, filename);
    const fileContent = await fs.readFile(filePath, "utf-8");
    const { data } = matter(fileContent);
    const validatedData = PageSchema.parse(data);

    return {
      slug: filename.replace(/\.md$/, ""),
      ...validatedData,
    };
  } catch (error) {
    console.error(`Error processing blog file ${filename}:`, error);
    return null;
  }
}

export async function getAllBlogs(): Promise<PageData[]> {
  try {
    const directoryExists = await validateBlogDirectory();
    if (!directoryExists) return [];

    const files = await fs.readdir(BLOG_DIRECTORY);
    const blogs = await Promise.all(
      files.filter((filename) => filename.endsWith(".md")).map(processBlogFile),
    );
    const validBlogs = blogs.filter((blog): blog is PageData => blog !== null);
    return validBlogs.filter((blog) => blog.published);
  } catch (error) {
    console.error("Error reading blog directory:", error);
    return [];
  }
}

export async function getLatestBlogs(): Promise<PageData[]> {
  const blogs = await getAllBlogs();
  return blogs
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);
}
