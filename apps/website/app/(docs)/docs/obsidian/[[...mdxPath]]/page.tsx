import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateStaticParamsFor, importPage } from "nextra/pages";
import DocsPageTemplate from "../../_components/DocsPageTemplate";

type DocsPageProps = {
  params: Promise<{
    mdxPath?: string[];
  }>;
};

type ImportedPage = Awaited<ReturnType<typeof importPage>>;

const generateAllStaticParams = generateStaticParamsFor("mdxPath");

const loadPage = async (mdxPath?: string[]): Promise<ImportedPage> =>
  importPage(["obsidian", ...(mdxPath ?? [])]);

export const generateStaticParams = async (): Promise<
  Array<{ mdxPath?: string[] }>
> => {
  const staticParams = await generateAllStaticParams();

  return staticParams.flatMap(({ mdxPath }) => {
    if (!Array.isArray(mdxPath) || mdxPath[0] !== "obsidian") {
      return [];
    }

    const platformPath = mdxPath.slice(1);

    return platformPath.length ? [{ mdxPath: platformPath }] : [{}];
  });
};

const Page = async ({ params }: DocsPageProps): Promise<React.ReactElement> => {
  try {
    const { mdxPath } = await params;
    const result = await loadPage(mdxPath);
    const { default: MDXContent, ...wrapperProps } = result;

    return (
      <DocsPageTemplate {...wrapperProps}>
        <MDXContent params={{ mdxPath: mdxPath ?? [] }} />
      </DocsPageTemplate>
    );
  } catch (error) {
    console.error("Error rendering Obsidian docs page:", error);
    notFound();
  }
};

export const generateMetadata = async ({
  params,
}: DocsPageProps): Promise<Metadata> => {
  try {
    const { mdxPath } = await params;
    const { metadata } = await loadPage(mdxPath);

    return metadata;
  } catch (error) {
    console.error("Error generating Obsidian docs metadata:", error);

    return {
      title: "Obsidian docs",
    };
  }
};

export default Page;
