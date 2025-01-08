import fs from "fs/promises";
import path from "path";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { DocsHeader } from "~/components/DocsHeader";
import { Prose } from "~/components/Prose";
import { collectSections } from "~/utils/sections";
import { TableOfContents } from "~/components/TableOfContents";
import { getMarkdownPage } from "~/utils/getMarkdownFile";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

const PATH = "app/(docs)/docs/roam/pages";
const DIRECTORY = path.join(process.cwd(), PATH);

export default async function Page({ params }: Params) {
  try {
    const { slug } = await params;
    const { data, contentHtml } = await getMarkdownPage({
      slug,
      directory: DIRECTORY,
    });
    const tableOfContents = await collectSections(contentHtml);

    return (
      <>
        <div className="min-w-0 max-w-2xl flex-auto px-4 py-8 lg:max-w-none lg:pl-8 lg:pr-0 xl:px-16">
          <article className="[&::-webkit-scrollbar]:hidden">
            <DocsHeader title={data.title} />
            <Prose>
              <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
            </Prose>
          </article>
          {/* <PrevNextLinks /> */}
        </div>
        <TableOfContents tableOfContents={tableOfContents} />
      </>
    );
  } catch (error) {
    console.error("Error rendering docs page:", error);
    return notFound();
  }
}

export async function generateStaticParams() {
  try {
    const directoryExists = await fs
      .stat(DIRECTORY)
      .then((stats) => stats.isDirectory())
      .catch(() => false);

    if (!directoryExists) {
      console.log("No docs directory found");
      return [];
    }

    const files = await fs.readdir(DIRECTORY);

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
    const { data } = await getMarkdownPage({
      slug,
      directory: DIRECTORY,
    });

    return {
      title: data.title,
      authors: [{ name: data.author }],
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Docs",
    };
  }
}
