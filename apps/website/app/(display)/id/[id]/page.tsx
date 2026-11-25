import { notFound } from "next/navigation";
import { loadDisplayNode } from "./loadDisplayNode";

export const dynamic = "force-dynamic";

const DisplayPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> => {
  const { id } = await params;
  let resourceId: string;
  try {
    resourceId = decodeURIComponent(id);
  } catch {
    notFound();
  }
  const node = await loadDisplayNode(resourceId);
  if (!node) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <article>
        <header className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-sm text-slate-600">
            {node.typeLabel} · {node.source}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            {node.title}
          </h1>
        </header>
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: node.bodyHtml }}
        />
      </article>
    </main>
  );
};

export default DisplayPage;
