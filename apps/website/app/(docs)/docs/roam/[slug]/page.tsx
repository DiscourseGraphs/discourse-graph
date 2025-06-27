import { docMap } from "../docMap";
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

  return <DocsPage params={Promise.resolve({ slug })} directory={directory} />;
};

export default Page;

export const generateStaticParams = () =>
  generateDocsStaticParams(docMap.default);

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const directory = docMap[params.slug] ?? docMap.default;
  return generateDocsMetadata({ params: Promise.resolve(params), directory });
}
