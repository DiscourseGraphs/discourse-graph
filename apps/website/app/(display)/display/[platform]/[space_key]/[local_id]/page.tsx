import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { nodePathFromSegments } from "~/utils/conversion/nodeLookup";
import type { NodePath } from "~/utils/conversion/nodeAddress";
import { jsonForScript } from "~/utils/conversion/sanitizeHtml";
import {
  loadDisplayNode,
  type DisplayKind,
  type DisplayNode,
  type LinkedNode,
} from "~/(display)/display/loadDisplayNode";

type DisplayPageProps = {
  params: Promise<{ platform: string; space_key: string; local_id: string }>;
};

const KIND_LABELS: Record<DisplayKind, string> = {
  node: "Node",
  relation: "Relation",
  nodeType: "Node type",
  relationType: "Relation type",
};

const resolveNodePath = async (
  params: DisplayPageProps["params"],
): Promise<NodePath | undefined> => {
  const { platform, space_key, local_id } = await params;
  const nodePath = nodePathFromSegments({
    platform,
    spaceKey: decodeURIComponent(space_key),
    localId: decodeURIComponent(local_id),
  });
  return "failure" in nodePath ? undefined : nodePath;
};

const loadOrNotFound = async (
  params: DisplayPageProps["params"],
): Promise<DisplayNode> => {
  const nodePath = await resolveNodePath(params);
  const node = nodePath && (await loadDisplayNode(nodePath));
  if (!node) notFound();
  return node;
};

export const generateMetadata = async ({
  params,
}: DisplayPageProps): Promise<Metadata> => {
  const node = await loadOrNotFound(params);
  return {
    title: `${node.title} | Discourse Graphs`,
    openGraph: { title: node.title, type: "article" },
    alternates: {
      types: { "application/ld+json": node.dataUrl },
    },
  };
};

const formatDate = (timestamp: string): string =>
  new Date(`${timestamp}Z`).toISOString().substring(0, 10);

const NodeLink = ({ node }: { node: LinkedNode }): React.ReactElement => (
  <span>
    {node.href ? (
      <Link href={node.href} className="text-blue-700 hover:underline">
        {node.title}
      </Link>
    ) : (
      node.title
    )}
    {node.typeLabel && (
      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
        {node.typeLabel}
      </span>
    )}
    {node.otherSpace && (
      <Link
        href={node.otherSpace.href}
        title={`In another space: ${node.otherSpace.name} (${node.otherSpace.platform})`}
        className="ml-2 inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800 hover:underline"
      >
        <span aria-hidden="true">⇄</span>
        {node.otherSpace.name}
        <span className="text-amber-600">· {node.otherSpace.platform}</span>
      </Link>
    )}
  </span>
);

const RelationsPanel = ({
  node,
}: {
  node: DisplayNode;
}): React.ReactElement | null => {
  if (node.relationGroups.length === 0) return null;
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Relations
      </h2>
      {node.relationGroups.map((group) => (
        <section key={group.label} className="mb-3 last:mb-0">
          <h3 className="mb-1 text-sm font-medium text-slate-800">
            {group.label}
          </h3>
          <ul className="space-y-1 text-sm">
            {group.nodes.map((linked, index) => (
              <li key={`${linked.href ?? linked.title}-${index}`}>
                <NodeLink node={linked} />
                {linked.relationHref && (
                  <Link
                    href={linked.relationHref}
                    title="Open the relation"
                    aria-label="Open the relation"
                    className="ml-1.5 inline-flex align-middle text-slate-400 hover:text-blue-700"
                  >
                    <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
};

const RelationEndpoints = ({
  endpoints,
}: {
  endpoints: NonNullable<DisplayNode["endpoints"]>;
}): React.ReactElement => (
  <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
    {endpoints.source ? <NodeLink node={endpoints.source} /> : "Private node"}
    <span className="mx-2 font-medium text-slate-600">{endpoints.label}</span>
    {endpoints.destination ? (
      <NodeLink node={endpoints.destination} />
    ) : (
      "Private node"
    )}
  </p>
);

const InstanceList = ({
  node,
}: {
  node: DisplayNode;
}): React.ReactElement | null => {
  const count = node.instances?.length ?? node.relationInstances?.length;
  if (!count) return null;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-800">
        Instances <span className="font-normal text-slate-500">({count})</span>
      </h2>
      <ul className="space-y-1 text-sm">
        {node.instances?.map((instance, index) => (
          <li key={`${instance.href ?? instance.title}-${index}`}>
            <NodeLink node={instance} />
          </li>
        ))}
        {node.relationInstances?.map((relation, index) => (
          <li key={`${relation.href ?? "relation"}-${index}`}>
            {relation.source ? (
              <NodeLink node={relation.source} />
            ) : (
              "Private node"
            )}
            <span className="mx-2 font-medium text-slate-600">
              {relation.href ? (
                <Link href={relation.href} className="hover:underline">
                  {node.title}
                </Link>
              ) : (
                node.title
              )}
            </span>
            {relation.destination ? (
              <NodeLink node={relation.destination} />
            ) : (
              "Private node"
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

const DisplayPage = async ({
  params,
}: DisplayPageProps): Promise<React.ReactElement> => {
  const node = await loadOrNotFound(params);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonForScript(node.jsonLd) }}
      />
      <header className="mb-6">
        <p className="text-sm text-slate-500">
          {node.typeLabel && node.typeHref ? (
            <Link href={node.typeHref} className="hover:underline">
              {node.typeLabel}
            </Link>
          ) : (
            (node.typeLabel ?? KIND_LABELS[node.kind])
          )}{" "}
          ·{" "}
          <Link href={node.spaceHref} className="hover:underline">
            {node.spaceName}
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {node.title}
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          {node.authorName && <>By {node.authorName} · </>}
          Created {formatDate(node.created)} · Modified{" "}
          {formatDate(node.modified)}
        </p>
        {node.complement && (
          <p className="mt-2 text-sm text-slate-600">
            Read in reverse: {node.complement}
          </p>
        )}
      </header>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {node.endpoints && <RelationEndpoints endpoints={node.endpoints} />}
          <InstanceList node={node} />
          {node.bodyHtml && (
            <section
              id="content"
              className="prose prose-slate max-w-none rounded-lg border border-slate-200 bg-white p-6"
              dangerouslySetInnerHTML={{ __html: node.bodyHtml }}
            />
          )}
        </div>
        <RelationsPanel node={node} />
      </div>
      <footer className="mt-8 space-y-1 text-xs text-slate-500">
        {node.rid && <p className="break-all">RID: {node.rid}</p>}
        <p>
          <a href={node.dataUrl} className="hover:underline">
            Linked data (JSON-LD)
          </a>
          {node.bodyHtml && (
            <>
              {" · "}
              <a href={node.bodyUrl} className="hover:underline">
                Raw content
              </a>
            </>
          )}
        </p>
      </footer>
    </main>
  );
};

export default DisplayPage;
