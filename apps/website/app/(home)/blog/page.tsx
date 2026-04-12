import type { Metadata } from "next";
import Link from "next/link";
import { importPage } from "nextra/pages";
import { getAllBlogs } from "./readBlogs";

type ImportedPage = Awaited<ReturnType<typeof importPage>>;

const hasPrimaryHeading = (sourceCode: string): boolean =>
  /(^|\n)#\s+\S/m.test(sourceCode);

const loadBlogIndex = async (): Promise<ImportedPage> => importPage(["blog"]);

const BlogIndex = async (): Promise<React.ReactElement> => {
  const blogs = await getAllBlogs();
  const { default: MDXContent, metadata, sourceCode } = await loadBlogIndex();
  const showsPrimaryHeading = hasPrimaryHeading(sourceCode);

  return (
    <div className="flex-1 bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-12 px-6 py-12">
        <article className="rounded-xl bg-white p-8 shadow-md">
          <div className="space-y-4">
            {!showsPrimaryHeading && (
              <h1 className="text-4xl font-bold text-primary">
                {metadata.title}
              </h1>
            )}
            <div className="text-gray-600">
              <MDXContent />
            </div>
          </div>
          <div className="mt-8">
            <ul className="space-y-6">
              {blogs.length === 0 ? (
                <p className="text-left text-lg text-gray-600">
                  No updates yet! Check back soon. 😊
                </p>
              ) : (
                blogs.map((blog) => (
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
                ))
              )}
            </ul>
          </div>
        </article>
      </div>
    </div>
  );
};

export const generateMetadata = async (): Promise<Metadata> => {
  try {
    const { metadata } = await loadBlogIndex();

    return metadata;
  } catch (error) {
    console.error("Error generating blog index metadata:", error);

    return {
      title: "All Updates",
    };
  }
};

export default BlogIndex;
