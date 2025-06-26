import { DocsPage } from "../../components/DocsPage";
import { docMap } from "../docMap";
import { Metadata } from "next";
import {
  generateDocsStaticParams,
  generateDocsMetadata,
} from "../../components/DocsPage";

export default async function Page({ params }: { params: { slug: string } }) {
  // Get the directory for this slug, fallback to Obsidian docs if not mapped
  const directory = docMap[params.slug] ?? docMap.default;
  console.log("directory mapped", directory);
  // Pass params directly since they're already resolved in Next.js 14
  return <DocsPage params={params} directory={directory} />;
}

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
