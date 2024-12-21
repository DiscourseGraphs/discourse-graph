import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

async function getBlog(slug) {
  const blogDirectory = path.join(process.cwd(), "/blogs");
  const filePath = path.join(blogDirectory, `${slug}.md`);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);

  // Convert Markdown content to HTML
  const processedContent = await remark().use(html).process(content);
  const contentHtml = processedContent.toString();

  return { data, contentHtml };
}

export default async function BlogPost({ params }) {
  const { slug } = await params;
  const { data, contentHtml } = await getBlog(slug);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-6 py-12">
      <div className="max-w-4xl w-full">
        <header className="mb-8 text-center">
          <h1 className="text-5xl font-bold leading-tight text-gray-800 mb-4">
            {data.title}
          </h1>
          <p className="text-gray-500 text-sm italic">
            {new Date(data.date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </header>
        <article
          className="prose prose-lg lg:prose-xl prose-gray mx-auto text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </div>
    </div>
  );
}

