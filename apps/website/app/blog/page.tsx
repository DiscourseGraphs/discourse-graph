import fs from "fs/promises"; // Using promises for non-blocking operations
import path from "path";
import matter from "gray-matter";
import Link from "next/link";
import { BlogSchema, type Blog } from "./schema";

// Directory path moved to a constant for reusability and configuration
const BLOG_DIRECTORY = path.join(process.cwd(), "app/blog/posts");

async function getAllBlogs(): Promise<Blog[]> {
  try {
    const files = await fs.readdir(BLOG_DIRECTORY); // Non-blocking file read

    const blogs = await Promise.all(
      files
        .filter((filename) => filename.endsWith(".md")) // Ensure valid filenames
        .map(async (filename) => {
          const filePath = path.join(BLOG_DIRECTORY, filename);
          const fileContent = await fs.readFile(filePath, "utf-8"); // Non-blocking file read
          const { data } = matter(fileContent);

          try {
            const validatedData = BlogSchema.parse(data);

            return {
              slug: filename.replace(".md", ""),
              ...validatedData,
            };
          } catch (error) {
            console.error(`Invalid front matter in file: ${filename}`, error);
            return null; // Skip invalid blogs
          }
        }),
    );

    return blogs.filter(Boolean) as Blog[]; // Filter out null values
  } catch (error) {
    console.error("Error reading blog directory:", error);
    return []; // Return an empty array on failure
  }
}

export default async function BlogIndex() {
  const blogs = await getAllBlogs();
  return (
    <div className="flex-1 bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-12 px-6 py-12">
        <div className="rounded-xl bg-white p-8 shadow-md">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-primary">All Updates</h1>
          </div>
          <div>
            <ul className="space-y-6">
              {blogs.map((blog) => (
                <li
                  key={blog.slug}
                  className="flex items-start justify-between border-b border-gray-200 pb-4 last:border-b-0"
                >
                  <div className="w-4/5">
                    <Link
                      href={`/blog/${blog.slug}`}
                      className="block text-2xl font-semibold text-blue-600 hover:underline"
                    >
                      {blog.title}
                    </Link>
                    <p className="mt-2 text-sm italic text-gray-500">
                      {blog.date}
                    </p>
                  </div>
                  <div className="w-1/5 text-right text-gray-600">
                    by {blog.author}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
