import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { BLOG_DIRECTORY } from "./blogDirectory";
import { BlogFrontmatterSchema, type BlogData } from "./blogSchema";

const BLOG_FILE_EXTENSION_RE = /\.mdx?$/u;
const BLOG_INDEX_FILE_RE = /^index\.mdx?$/u;

const validateBlogDirectory = async (): Promise<boolean> => {
  try {
    const stats = await fs.stat(BLOG_DIRECTORY);
    return stats.isDirectory();
  } catch {
    console.log("No blog content directory found.");
    return false;
  }
};

const isBlogContentFile = (filename: string): boolean =>
  BLOG_FILE_EXTENSION_RE.test(filename) && !BLOG_INDEX_FILE_RE.test(filename);

const getSlugFromFilename = (filename: string): string =>
  filename.replace(BLOG_FILE_EXTENSION_RE, "");

const processBlogFile = async (filename: string): Promise<BlogData | null> => {
  try {
    const filePath = path.resolve(BLOG_DIRECTORY, filename);
    const fileContent = await fs.readFile(filePath, "utf-8");
    const { data } = matter(fileContent);
    const validatedData = BlogFrontmatterSchema.parse(data);

    return {
      slug: getSlugFromFilename(filename),
      ...validatedData,
    };
  } catch (error) {
    console.error(`Error processing blog file ${filename}:`, error);
    return null;
  }
};

const sortBlogsByDate = (left: BlogData, right: BlogData): number =>
  new Date(right.date).getTime() - new Date(left.date).getTime();

const listBlogFiles = async (): Promise<string[]> => {
  const directoryExists = await validateBlogDirectory();

  if (!directoryExists) {
    return [];
  }

  const files = await fs.readdir(BLOG_DIRECTORY);

  return files.filter(isBlogContentFile);
};

export const getAllBlogs = async (): Promise<BlogData[]> => {
  try {
    const files = await listBlogFiles();
    const blogs = await Promise.all(files.map(processBlogFile));
    const validBlogs = blogs.filter((blog): blog is BlogData => blog !== null);

    return validBlogs.filter((blog) => blog.published).sort(sortBlogsByDate);
  } catch (error) {
    console.error("Error reading blog directory:", error);
    return [];
  }
};

export const getLatestBlogs = async (): Promise<BlogData[]> =>
  (await getAllBlogs()).slice(0, 3);

export const getBlogBySlug = async (slug: string): Promise<BlogData | null> => {
  const safeSlug = path.basename(slug);

  if (safeSlug !== slug) {
    return null;
  }

  try {
    const files = await listBlogFiles();
    const filename = files.find((file) => getSlugFromFilename(file) === slug);

    if (!filename) {
      return null;
    }

    const blog = await processBlogFile(filename);

    if (!blog?.published) {
      return null;
    }

    return blog;
  } catch (error) {
    console.error(`Error reading blog "${slug}":`, error);
    return null;
  }
};
