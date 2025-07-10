import { docMap } from "~/(docs)/docs/obsidian/docMap";
import { Metadata } from "next";
import {
  generateDocsStaticParams,
  generateDocsMetadata,
  DocsPage,
} from "~/components/DocsPage";

const Page = async ({ params }: { params: { slug: string } }) => {
  const { slug } = await params;
  const directory = docMap[slug] ?? docMap.default;

  return <DocsPage params={Promise.resolve({ slug })} directory={directory} />;
};

export default Page;

export const generateStaticParams = () =>
  generateDocsStaticParams(docMap.default);

export const generateMetadata = async ({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> => {
  const directory = docMap[params.slug] ?? docMap.default;
  return generateDocsMetadata({
    params: Promise.resolve({ slug: params.slug }),
    directory,
  });
};
