import type { FrontMatterCache, TFile } from "obsidian";
import type { default as DiscourseGraphPlugin } from "~/index";
import { getLoggedInClient } from "./supabaseContext";

export const publishNode = async ({
  plugin,
  file,
  frontmatter,
}: {
  plugin: DiscourseGraphPlugin;
  file: TFile;
  frontmatter: FrontMatterCache;
}): Promise<void> => {
  const nodeId = frontmatter.nodeInstanceId as string | undefined;
  if (!nodeId) throw new Error("Please sync the node first");
  const client = await getLoggedInClient(plugin);
  if (!client) throw new Error("Cannot get client");
  const myGroupResponse = await client
    .from("group_membership")
    .select("group_id");
  if (myGroupResponse.error) throw myGroupResponse.error;
  const myGroup = myGroupResponse.data[0]?.group_id;
  if (!myGroup) throw new Error("Cannot get group");
  const existingPublish =
    (frontmatter.publishedToGroups as undefined | string[]) || [];
  if (existingPublish.includes(myGroup)) return; // already published
  const idResponse = await client
    .from("Content")
    .select("id")
    .eq("source_local_id", nodeId)
    .eq("variant", "direct")
    .maybeSingle();
  if (idResponse.error || !idResponse.data) {
    throw idResponse.error || new Error("no data while fetching node");
  }
  const contentId = idResponse.data.id;
  const publishResponse = await client.from("ContentAccess").insert({
    /* eslint-disable @typescript-eslint/naming-convention */
    account_uid: myGroup,
    content_id: contentId,
    /* eslint-enable @typescript-eslint/naming-convention */
  });
  if (publishResponse.error && publishResponse.error.code !== "23505")
    // 23505 is duplicate key, which counts as a success.
    throw publishResponse.error;
  // check if there is a corresponding concept.
  const conceptIdResponse = await client
    .from("Concept")
    .select("id")
    .eq("represented_by_id", contentId)
    .maybeSingle();
  if (conceptIdResponse.error) throw conceptIdResponse.error;
  if (conceptIdResponse.data) {
    const publishConceptResponse = await client.from("ConceptAccess").insert({
      /* eslint-disable @typescript-eslint/naming-convention */
      account_uid: myGroup,
      concept_id: conceptIdResponse.data.id,
      /* eslint-enable @typescript-eslint/naming-convention */
    });
    if (
      publishConceptResponse.error &&
      publishConceptResponse.error.code !== "23505"
    )
      // 23505 is duplicate key, which counts as a success.
      throw publishConceptResponse.error;
  }
  await plugin.app.fileManager.processFrontMatter(
    file,
    (fm: Record<string, unknown>) => {
      fm.publishedToGroups = [...existingPublish, myGroup];
    },
  );
};
