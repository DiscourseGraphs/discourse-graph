import { docMap } from "~/(docs)/docs/roam/docMap";
import { Metadata } from "next";
import {
  generateDocsStaticParams,
  generateDocsMetadata,
  DocsPage,
} from "~/components/DocsPage";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

const Page = async ({ params }: Params) => {
  const { slug } = await params;
  const directory = docMap[slug] ?? docMap.default;

  return await DocsPage({ params: Promise.resolve({ slug }), directory });
};

export default Page;

export const generateStaticParams = () =>
  generateDocsStaticParams([...new Set(Object.values(docMap))]);

export const generateMetadata = async ({
  params,
}: Params): Promise<Metadata> => {
  const { slug } = await params;
  const directory = docMap[slug] ?? docMap.default;
  return generateDocsMetadata({ params: Promise.resolve({ slug }), directory });
};
