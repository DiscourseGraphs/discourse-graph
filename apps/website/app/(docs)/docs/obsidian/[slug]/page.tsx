import { docMap } from "~/(docs)/docs/obsidian/docMap";
import { Metadata } from "next";
import {
  generateDocsStaticParams,
  generateDocsMetadata,
  DocsPage,
} from "~/components/DocsPage";

const Page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const directory = docMap[slug] ?? docMap.default;

  return await DocsPage({ params: Promise.resolve({ slug }), directory });
};

export default Page;

export const generateStaticParams = () =>
  generateDocsStaticParams([...new Set(Object.values(docMap))]);

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> => {
  const { slug } = await params;
  const directory = docMap[slug] ?? docMap.default;
  return generateDocsMetadata({
    params: Promise.resolve({ slug }),
    directory,
  });
};
