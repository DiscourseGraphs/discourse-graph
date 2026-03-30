import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { importPage } from "nextra/pages";
import { useMDXComponents } from "../../../../mdx-components";

type ImportedPage = Awaited<ReturnType<typeof importPage>>;

const { wrapper } = useMDXComponents();

const Wrapper = wrapper as React.ComponentType<{
  children: React.ReactNode;
  metadata: ImportedPage["metadata"];
  toc: ImportedPage["toc"];
}>;

const loadPage = async (): Promise<ImportedPage> => importPage([]);

const Page = async (): Promise<React.ReactElement> => {
  try {
    const { default: MDXContent, metadata, toc } = await loadPage();

    return (
      <Wrapper metadata={metadata} toc={toc}>
        <MDXContent params={{ mdxPath: [] }} />
      </Wrapper>
    );
  } catch (error) {
    console.error("Error rendering docs landing page:", error);
    notFound();
  }
};

export const generateMetadata = async (): Promise<Metadata> => {
  try {
    const { metadata } = await loadPage();

    return metadata;
  } catch (error) {
    console.error("Error generating docs landing metadata:", error);

    return {
      title: "Docs",
    };
  }
};

export default Page;
