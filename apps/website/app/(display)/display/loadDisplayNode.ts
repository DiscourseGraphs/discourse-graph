import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/database/dbTypes";
import { envContents } from "@repo/database/dbDotEnv";
import { renderNodeBody } from "~/utils/conversion/convert";
import { nodePathFromRid } from "~/utils/conversion/nodeAddress";
import { findNode } from "~/utils/conversion/nodeLookup";

type DisplayNode = {
  title: string;
  typeLabel: string;
  source: string;
  bodyHtml: string;
};

export const loadDisplayNode = async (
  rid: string,
): Promise<DisplayNode | undefined> => {
  const nodePath = nodePathFromRid(rid);
  if (!nodePath) return undefined;
  const env = envContents();
  // A signed-in reader must see exactly what the public link exposes.
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
    throw new Error("Missing public Supabase configuration");
  const supabase = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
  );
  const found = await findNode({ supabase, nodePath });
  if ("failure" in found) {
    if (found.failure.status === 404) return undefined;
    throw new Error(found.failure.error?.message);
  }
  const { space, concept, contents } = found;
  if (concept.is_schema || concept.is_relation) return undefined;
  const schema =
    concept.schema_id === null
      ? null
      : await supabase
          .from("Concept")
          .select("name, literal_content")
          .eq("id", concept.schema_id)
          .maybeSingle();
  if (schema?.error) throw new Error(schema.error.message);
  const literal = schema?.data?.literal_content;
  const label =
    literal && typeof literal === "object" && !Array.isArray(literal)
      ? literal.label
      : undefined;
  const text = contents.find((entry) => entry.variant === "full")?.text ?? "";
  return {
    title:
      contents.find((entry) => entry.variant === "direct")?.text ??
      concept.name,
    typeLabel:
      typeof label === "string" && label
        ? label
        : (schema?.data?.name ?? "Node"),
    source: space.name,
    bodyHtml: renderNodeBody(text, space.platform),
  };
};
