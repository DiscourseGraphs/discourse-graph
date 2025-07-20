import fs from "fs/promises";
import path from "path";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { DocsHeader } from "~/components/DocsHeader";
import { Prose } from "~/components/Prose";
import { TableOfContents } from "~/components/TableOfContents";
import { getProcessedMarkdownFile } from "~/utils/getProcessedMarkdownFile";
import { collectSections } from "~/utils/getSections";
import { PrevNextLinks } from "~/components/PrevNextLinks";
import { getFileMetadata } from "~/utils/getFileMetadata";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

type DocsPageProps = Params & {
  directory: string;
};

export const DocsPage = async ({ params, directory }: DocsPageProps) => {
  try {
    const { slug } = await params;

    const DIRECTORY = path.join(process.cwd(), directory);
    const { data, contentHtml } = await getProcessedMarkdownFile({
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
          <PrevNextLinks />
        </div>
        <TableOfContents tableOfContents={tableOfContents} />
      </>
    );
  } catch (error) {
    console.error("Error rendering docs page:", error);
    return notFound();
  }
};

export const generateDocsStaticParams = async (directory: string) => {
  try {
    const directoryExists = await fs
      .stat(directory)
      .then((stats) => stats.isDirectory())
      .catch(() => false);

    if (!directoryExists) {
      console.log("No docs directory found");
      return [];
    }

    const files = await fs.readdir(directory);
    const mdFiles = files.filter((filename) => filename.endsWith(".md"));

    const publishedFiles = await Promise.all(
      mdFiles.map(async (filename) => {
        const { published } = await getFileMetadata({
          filename,
          directory,
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
};

export const generateDocsMetadata = async ({
  params,
  directory,
}: DocsPageProps): Promise<Metadata> => {
  try {
    const { slug } = await params;
    const { data } = await getProcessedMarkdownFile({
      slug,
      directory,
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
};
