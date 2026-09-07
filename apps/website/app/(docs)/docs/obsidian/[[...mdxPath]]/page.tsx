import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateStaticParamsFor, importPage } from "nextra/pages";
import DocsPageTemplate from "../../_components/DocsPageTemplate";
import { getCanonicalMetadata, getDocsPath } from "~/seo";
import { buildDocsPageMetadata } from "../../docsMetadata";
import { JsonLd } from "~/components/JsonLd";
import {
  createDocsBreadcrumbStructuredData,
  createStructuredDataDocument,
} from "~/utils/structuredData";

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
    const { default: MDXContent, metadata, ...wrapperProps } = result;
    const title =
      typeof metadata.title === "string" ? metadata.title : "Obsidian docs";

    return (
      <>
        <JsonLd
          data={createStructuredDataDocument([
            createDocsBreadcrumbStructuredData({
              mdxPath,
              platform: "obsidian",
              title,
            }),
          ])}
        />
        <DocsPageTemplate metadata={metadata} {...wrapperProps}>
          {({ h1 }) => (
            <MDXContent
              components={{ h1 }}
              params={{ mdxPath: mdxPath ?? [] }}
            />
          )}
        </DocsPageTemplate>
      </>
    );
  } catch (error) {
    console.error("Error rendering Obsidian docs page:", error);
    notFound();
  }
};

export const generateMetadata = async ({
  params,
}: DocsPageProps): Promise<Metadata> => {
  const { mdxPath } = await params;
  const canonicalMetadata = getCanonicalMetadata(
    getDocsPath({ mdxPath, platform: "obsidian" }),
  );

  try {
    const { metadata } = await loadPage(mdxPath);

    return {
      ...buildDocsPageMetadata({ metadata, platform: "obsidian" }),
      ...canonicalMetadata,
    };
  } catch (error) {
    console.error("Error generating Obsidian docs metadata:", error);

    return {
      title: "Obsidian docs",
      ...canonicalMetadata,
    };
  }
};

export default Page;
