import fs from "fs/promises";
import path from "path";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getProcessedMarkdownFile } from "~/utils/getProcessedMarkdownFile";
import { BLOG_PATH } from "~/data/constants";
import { getFileMetadata } from "~/utils/getFileMetadata";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function BlogPost({ params }: Params) {
  try {
    const { slug } = await params;
    const { data, contentHtml } = await getProcessedMarkdownFile({
      slug,
      directory: BLOG_PATH,
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
}

export async function generateStaticParams() {
  try {
    const blogPath = path.resolve(process.cwd(), BLOG_PATH);
    const directoryExists = await fs
      .stat(blogPath)
      .then((stats) => stats.isDirectory())
      .catch(() => false);

    if (!directoryExists) {
      console.log(
        "No app/blog/posts directory found. Returning empty params...",
      );
      return [];
    }

    const files = await fs.readdir(blogPath);

    const mdFiles = files.filter((filename) => filename.endsWith(".md"));

    const publishedFiles = await Promise.all(
      mdFiles.map(async (filename) => {
        const { published } = await getFileMetadata({
          filename,
          directory: BLOG_PATH,
        });
        return { filename, published };
      }),
    );

    return publishedFiles
      .filter(({ published }) => published)
      .map(({ filename }) => ({
        slug: filename.replace(/\.md$/, ""),
      }));
  } catch (error) {
    console.error("Error generating static params:", error);
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  try {
    const { slug } = await params;
    const { data } = await getProcessedMarkdownFile({
      slug,
      directory: BLOG_PATH,
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
}
