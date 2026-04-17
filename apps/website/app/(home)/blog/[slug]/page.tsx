import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { importPage } from "nextra/pages";
import type { BlogData } from "../blogSchema";
import { getAllBlogs, getBlogBySlug } from "../readBlogs";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

type ImportedPage = Awaited<ReturnType<typeof importPage>>;

const hasPrimaryHeading = (sourceCode: string): boolean =>
  /(^|\n)#\s+\S/m.test(sourceCode);

const loadBlogPage = async (slug: string): Promise<ImportedPage> =>
  importPage(["blog", slug]);

const getMetadataDescription = ({
  description,
  metadata,
}: {
  description?: string;
  metadata: Metadata;
}): string | undefined =>
  description ??
  (typeof metadata.description === "string" ? metadata.description : undefined);

const buildBlogPostMetadata = ({
  blog,
  pageMetadata,
}: {
  blog: BlogData;
  pageMetadata: Metadata;
}): Metadata => {
  const description = getMetadataDescription({
    description: blog.description,
    metadata: pageMetadata,
  });

  return {
    ...pageMetadata,
    title: blog.title,
    description,
    authors: [{ name: blog.author }],
    keywords: blog.tags.length ? blog.tags : pageMetadata.keywords,
    alternates: {
      ...pageMetadata.alternates,
      canonical: `/blog/${blog.slug}`,
    },
    openGraph: {
      ...pageMetadata.openGraph,
      type: "article",
      title: blog.title,
      description,
      publishedTime: blog.date,
      authors: [blog.author],
      tags: blog.tags.length ? blog.tags : undefined,
      url: `/blog/${blog.slug}`,
    },
    twitter: {
      ...pageMetadata.twitter,
      title: blog.title,
      description,
    },
  };
};

const BlogPost = async ({ params }: Params): Promise<React.ReactElement> => {
  const { slug } = await params;
  const blog = await getBlogBySlug(slug);

  if (!blog) {
    notFound();
  }

  try {
    const { default: MDXContent, sourceCode } = await loadBlogPage(slug);
    const showsPrimaryHeading = hasPrimaryHeading(sourceCode);

    return (
      <div className="flex flex-1 flex-col items-center bg-gray-50 px-6 py-12">
        <article className="w-full max-w-4xl rounded-xl bg-white p-8 shadow-md sm:p-10">
          {!showsPrimaryHeading && (
            <h1 className="text-5xl font-bold leading-tight text-primary">
              {blog.title}
            </h1>
          )}
          <div className={showsPrimaryHeading ? "mb-6" : "mb-8 mt-4"}>
            <p className="text-sm italic text-gray-500">
              By {blog.author} | {blog.date}
            </p>
            {blog.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {blog.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-600"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <MDXContent />
          </div>
        </article>
      </div>
    );
  } catch (error) {
    console.error("Error rendering blog post:", error);
    notFound();
  }
};

export const generateStaticParams = async (): Promise<
  Array<{ slug: string }>
> => (await getAllBlogs()).map(({ slug }) => ({ slug }));

export const generateMetadata = async ({
  params,
}: Params): Promise<Metadata> => {
  try {
    const { slug } = await params;
    const blog = await getBlogBySlug(slug);

    if (!blog) {
      return {
        title: "Blog Post",
      };
    }

    const { metadata } = await loadBlogPage(slug);

    return buildBlogPostMetadata({
      blog,
      pageMetadata: metadata,
    });
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Blog Post",
    };
  }
};

export default BlogPost;
