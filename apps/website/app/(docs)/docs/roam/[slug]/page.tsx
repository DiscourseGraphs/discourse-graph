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

// export default async function Page({ params }: Params) {
//   try {
//     const { slug } = await params;
//     const { data, contentHtml } = await getBlog(slug, DIRECTORY);

//     return (
//       <div className="flex flex-1 flex-col items-center bg-gray-50 px-6 py-12">
//         <div className="w-full max-w-4xl">
//           <header className="mb-8 text-center">
//             <h1 className="mb-4 text-5xl font-bold leading-tight text-primary">
//               {data.title}
//             </h1>
//           </header>
//           <article
//             className="prose prose-lg lg:prose-xl prose-gray mx-auto leading-relaxed text-gray-700"
//             dangerouslySetInnerHTML={{ __html: contentHtml }}
//           />
//         </div>
//       </div>
//     );
//   } catch (error) {
//     console.error("Error rendering docs page:", error);
//     return notFound();
//   }
// }

// import { DocsHeader } from '@/components/DocsHeader'
// import { PrevNextLinks } from '@/components/PrevNextLinks'
// import { Prose } from '@/components/Prose'
// import { TableOfContents } from '@/components/TableOfContents'
// import { collectSections } from '@/lib/sections'

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const fileContent = await getFileContent(`${slug}.md`, DIRECTORY);
  const { data, contentHtml } = await getBlog(slug, DIRECTORY);
  const nodes = await extractHeadings(fileContent);
  const tableOfContents = collectSections(nodes);

  return (
    <>
      <div className="min-w-0 max-w-2xl flex-auto px-4 py-8 lg:max-w-none lg:pl-8 lg:pr-0 xl:px-16">
        <article className="[&::-webkit-scrollbar]:hidden">
          <DocsHeader title={data.title} />
          <Prose>
            <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
          </Prose>
        </article>
        {/* <PrevNextLinks /> */}
      </div>
      <TableOfContents tableOfContents={tableOfContents} />
    </>
  );
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
