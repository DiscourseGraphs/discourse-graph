import fs from "fs/promises";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getProcessedMarkdownFile } from "~/utils/getProcessedMarkdownFile";
import { getFileMetadata } from "~/utils/getFileMetadata";
import { BLOG_DIRECTORY } from "~/(home)/blog/blogDirectory";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

const BlogPost = async ({ params }: Params) => {
  try {
    const { slug } = await params;
    const { data, contentHtml } = await getProcessedMarkdownFile({
      slug,
      directory: BLOG_DIRECTORY,
    });

    return (
      <div className="flex flex-1 flex-col items-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-4xl">
          <header className="mb-8 text-center">
            <h1 className="mb-4 text-5xl font-bold leading-tight text-primary">
              {data.title}
            </h1>
            <p className="text-sm italic text-gray-500">
              By {data.author} • {data.date}
            </p>
          </header>
          <article
            className="prose prose-lg lg:prose-xl prose-gray mx-auto leading-relaxed text-gray-700"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error rendering blog post:", error);
    return notFound();
  }
};

export const generateStaticParams = async () => {
  try {
    const directoryExists = await fs
      .stat(BLOG_DIRECTORY)
      .then((stats) => stats.isDirectory())
      .catch(() => false);

    if (!directoryExists) {
      console.log(
        "No app/blog/posts directory found. Returning empty params...",
      );
      return [];
    }

    const files = await fs.readdir(BLOG_DIRECTORY);

    const mdFiles = files.filter((filename) => filename.endsWith(".md"));

    const results = await Promise.allSettled(
      mdFiles.map(async (filename) => {
        try {
          const { published } = await getFileMetadata({
            filename,
            directory: BLOG_DIRECTORY,
          });
          return { filename, published };
        } catch (error) {
          console.error(`Skipping ${filename} due to metadata error:`, error);
          return { filename, published: false };
        }
      }),
    );

    const publishedFiles = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    return publishedFiles
      .filter(({ published }) => published)
      .map(({ filename }) => ({
        slug: filename.replace(/\.md$/, ""),
      }));
  } catch (error) {
    console.error("Error generating static params:", error);
    return [];
  }
};

export const generateMetadata = async ({
  params,
}: Params): Promise<Metadata> => {
  try {
    const { slug } = await params;
    const { data } = await getProcessedMarkdownFile({
      slug,
      directory: BLOG_DIRECTORY,
    });

    return {
      title: data.title,
      authors: [{ name: data.author }],
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Blog Post",
    };
  }
};

export default BlogPost;
