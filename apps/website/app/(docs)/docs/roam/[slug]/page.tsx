import fs from "fs/promises";
import path from "path";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getBlog, getFileContent } from "~/(home)/blog/readBlogs";
import { DocsHeader } from "~/components/DocsHeader";
import { Prose } from "~/components/Prose";
import { collectSections } from "~/utils/sections";
import { extractHeadings } from "~/utils/getNodes";
import { TableOfContents } from "~/components/TableOfContents";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

const PATH = "app/(docs)/docs/roam/pages";
const DIRECTORY = path.join(process.cwd(), PATH);

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const fileContent = await getFileContent(`${slug}.md`, DIRECTORY);
  const { data, contentHtml } = await getBlog(slug, DIRECTORY);
  const nodes = await extractHeadings(fileContent);
  const tableOfContents = collectSections(nodes);

          {/* <PrevNextLinks /> */}
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
    const { data } = await getBlog(slug, DIRECTORY);

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
