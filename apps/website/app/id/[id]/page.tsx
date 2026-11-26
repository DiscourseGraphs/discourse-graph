import { createClient } from "@supabase/supabase-js";
import { envContents } from "@repo/database/dbDotEnv";
import type { Database } from "@repo/database/dbTypes";
import { ridToSpaceUriAndLocalId } from "@repo/database/lib/rid";
import { notFound } from "next/navigation";
import { NodeBody } from "./NodeBody";
import "~/globals.css";

export const dynamic = "force-dynamic";

const PublicNodePage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> => {
  const { id } = await params;
  // Next can preserve encoded route delimiters such as %2F in dynamic params.
  let rid = id;
  if (/^(?:https|orn)%3a/i.test(id)) {
    try {
      rid = decodeURIComponent(id);
    } catch {
      notFound();
    }
  }
  const { spaceUri, sourceLocalId } = ridToSpaceUriAndLocalId(rid);
  if (!spaceUri || !sourceLocalId) notFound();

  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = envContents();
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY)
    throw new Error("Missing public Supabase configuration");

  // A public link must use the same access rules even when its reader is signed in.
  const db = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const { data: space, error: spaceError } = await db
    .from("Space")
    .select("id, name")
    .eq("url", spaceUri)
    .maybeSingle();
  if (spaceError) throw spaceError;
  if (!space) notFound();

  const { data: node, error: nodeError } = await db
    .from("Concept")
    .select("name")
    .eq("space_id", space.id)
    .eq("source_local_id", sourceLocalId)
    .maybeSingle();
  if (nodeError) throw nodeError;
  if (!node) notFound();

  const { data: contents, error } = await db
    .from("Content")
    .select("variant, content_type, text")
    .eq("space_id", space.id)
    .eq("source_local_id", sourceLocalId)
    .in("variant", ["direct", "full"])
    .order("content_type");
  if (error) throw error;

  const title =
    contents.find((row) => row.variant === "direct")?.text ?? node.name;
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 border-b border-slate-200 pb-5">
        <p className="text-sm text-slate-600">{space.name}</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
      </header>
      <NodeBody contents={contents.filter((row) => row.variant === "full")} />
    </main>
  );
};

export default PublicNodePage;
