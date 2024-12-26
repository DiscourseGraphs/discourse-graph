import Link from "next/link";
import { getAllBlogs } from "./readBlogs";

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
