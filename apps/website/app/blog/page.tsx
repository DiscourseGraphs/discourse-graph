import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Link from "next/link";

async function getAllBlogs() {
  const blogDirectory = path.join(process.cwd(), "app/blog/posts");
  const files = fs.readdirSync(blogDirectory);

  return files.map((filename) => {
    const filePath = path.join(blogDirectory, filename);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(fileContent);

    return {
      slug: filename.replace(".md", ""),
      ...data,
    };
  });
}

export default async function BlogIndex() {
  const blogs = await getAllBlogs();

  return (
    <div className="flex-1 bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-12 px-6 py-12">
        <div className="rounded-xl bg-white p-8 shadow-md">
          <div className="mb-8">
            <h1 className="text-4xl text-primary font-bold text-gray-800">All Blog Posts</h1>
          </div>
          <div>
            <ul className="space-y-6">
              {blogs.map((blog) => (
                <li
                  key={blog.slug}
                  className="flex flex-col space-y-2 border-b border-gray-200 pb-4"
                >
                  <Link
                    href={`/blog/${blog.slug}`}
                    className="text-2xl font-semibold text-blue-600 hover:underline"
                  >
                    {blog.title}
                  </Link>
                  <p className="text-sm text-gray-500 italic">{blog.date}</p>
                  <p className="text-gray-700">{blog.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

