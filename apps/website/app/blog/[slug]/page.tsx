import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { BlogSchema, BlogFrontmatter } from "../schema";

async function getBlog(
  slug: string,
): Promise<{ data: BlogFrontmatter; contentHtml: string }> {
  try {
    const blogDirectory = path.join(process.cwd(), "app/blog/posts");
    const filePath = path.join(blogDirectory, `${slug}.md`);

    await fs.access(filePath);

    const fileContent = await fs.readFile(filePath, "utf-8");
    const { data: rawData, content } = matter(fileContent);

    const data = BlogSchema.parse(rawData);

    const processedContent = await remark().use(html).process(content);
    const contentHtml = processedContent.toString();

    return { data, contentHtml };
  } catch (error) {
    console.error("Error loading blog post:", error);
    return notFound();
  }
}

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function BlogPost({ params }: Params) {
  try {
    const { slug } = await params;
    const { data, contentHtml } = await getBlog(slug);

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
    const files = await fs.readdir(path.join(process.cwd(), "app/blog/posts"));
    return files
      .filter((filename) => filename.endsWith(".md"))
      .map((filename) => ({
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
    const { data } = await getBlog(slug);

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
