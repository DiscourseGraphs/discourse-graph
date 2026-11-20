import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { platformFromSegment } from "~/utils/conversion/nodeAddress";
import { jsonForScript } from "~/utils/conversion/sanitizeHtml";
import {
  loadDisplaySpace,
  type DisplaySpace,
  type SpaceEntry,
} from "~/(display)/display/loadDisplaySpace";

type SpacePageProps = {
  params: Promise<{ platform: string; space_key: string }>;
};

const loadOrNotFound = async (
  params: SpacePageProps["params"],
): Promise<DisplaySpace> => {
  const { platform, space_key } = await params;
  const knownPlatform = platformFromSegment(platform);
  const space =
    knownPlatform &&
    (await loadDisplaySpace({
      platform: knownPlatform,
      spaceKey: decodeURIComponent(space_key),
    }));
  if (!space) notFound();
  return space;
};

export const generateMetadata = async ({
  params,
}: SpacePageProps): Promise<Metadata> => {
  const space = await loadOrNotFound(params);
  return {
    title: `${space.name} | Discourse Graphs`,
    openGraph: { title: space.name, type: "website" },
    alternates: { types: { "application/ld+json": space.dataUrl } },
  };
};

const countLabel = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const EntryList = ({
  entries,
}: {
  entries: SpaceEntry[];
}): React.ReactElement => (
  <ul className="space-y-1 text-sm">
    {entries.map((entry) => (
      <li key={entry.href}>
        <Link href={entry.href} className="text-blue-700 hover:underline">
          {entry.title}
        </Link>
      </li>
    ))}
  </ul>
);

const SpacePage = async ({
  params,
}: SpacePageProps): Promise<React.ReactElement> => {
  const space = await loadOrNotFound(params);
  const nodeCount = space.nodeSections.reduce(
    (count, section) => count + section.nodes.length,
    0,
  );
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonForScript(space.jsonLd) }}
      />
      <header className="mb-6">
        <p className="text-sm text-slate-500">{space.platform} space</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {space.name}
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          {countLabel(nodeCount, "node")} ·{" "}
          {countLabel(space.relationCount, "relation")}
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {space.nodeSections.map((section) => (
            <section
              key={section.label}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <h2 className="mb-2 text-sm font-semibold text-slate-800">
                {section.label}{" "}
                <span className="font-normal text-slate-500">
                  ({section.nodes.length})
                </span>
              </h2>
              <EntryList entries={section.nodes} />
            </section>
          ))}
        </div>
        <aside className="space-y-4">
          {space.nodeTypes.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Node types
              </h2>
              <EntryList entries={space.nodeTypes} />
            </section>
          )}
          {space.relationTypes.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Relation types
              </h2>
              <EntryList entries={space.relationTypes} />
            </section>
          )}
        </aside>
      </div>
      <footer className="mt-8 space-y-1 text-xs text-slate-500">
        <p className="break-all">Space: {space.url}</p>
        <p>
          <a href={space.dataUrl} className="hover:underline">
            Linked data (JSON-LD)
          </a>
        </p>
      </footer>
    </main>
  );
};

export default SpacePage;
