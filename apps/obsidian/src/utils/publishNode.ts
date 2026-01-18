import type { FrontMatterCache, TFile } from "obsidian";
import type { default as DiscourseGraphPlugin } from "~/index";
import { getLoggedInClient, getSupabaseContext } from "./supabaseContext";
import { addFile } from "@repo/database/lib/files";
import mime from "mime-types";

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
  const context = await getSupabaseContext(plugin);
  if (!context) throw new Error("Cannot get context");
  const spaceId = context.spaceId;
  const myGroupResponse = await client
    .from("group_membership")
    .select("group_id");
  if (myGroupResponse.error) throw myGroupResponse.error;
  const myGroup = myGroupResponse.data[0]?.group_id;
  if (!myGroup) throw new Error("Cannot get group");
  const existingPublish =
    (frontmatter.publishedToGroups as undefined | string[]) || [];
  const idResponse = await client
    .from("Content")
    .select("last_modified")
    .eq("source_local_id", nodeId)
    .eq("space_id", spaceId)
    .eq("variant", "full")
    .maybeSingle();
  if (idResponse.error || !idResponse.data) {
    throw idResponse.error || new Error("no data while fetching node");
  }
  const lastModifiedDb = new Date(idResponse.data.last_modified + "Z");
  if (
    existingPublish.includes(myGroup) &&
    file.stat.mtime <= lastModifiedDb.getTime()
  )
    return; // already published
  const publishResponse = await client.from("ResourceAccess").upsert(
    {
      /* eslint-disable @typescript-eslint/naming-convention */
      account_uid: myGroup,
      source_local_id: nodeId,
      space_id: spaceId,
      /* eslint-enable @typescript-eslint/naming-convention */
    },
    { ignoreDuplicates: true },
  );
  if (publishResponse.error && publishResponse.error.code !== "23505")
    // 23505 is duplicate key, which counts as a success.
    throw publishResponse.error;

  const existingFiles: string[] = [];
  const embeds = plugin.app.metadataCache.getFileCache(file)?.embeds ?? [];
  for (const { link } of embeds) {
    const attachment = plugin.app.metadataCache.getFirstLinkpathDest(
      link,
      file.path,
    );
    if (attachment === null) {
      console.warn("Could not find file for " + link);
      continue;
    }
    const mimetype = mime.lookup(attachment.path) || "application/octet-stream";
    if (mimetype.startsWith("text/")) continue;
    existingFiles.push(attachment.path);
    const content = await plugin.app.vault.readBinary(attachment);
    await addFile({
      client,
      spaceId,
      sourceLocalId: nodeId,
      fname: attachment.path,
      mimetype,
      created: new Date(attachment.stat.ctime),
      lastModified: new Date(attachment.stat.mtime),
      content,
    });
  }
  let cleanupCommand = client
    .from("FileReference")
    .delete()
    .eq("space_id", spaceId)
    .eq("source_local_id", nodeId);
  if (existingFiles.length)
    cleanupCommand = cleanupCommand.notIn("filepath", [
      ...new Set(existingFiles),
    ]);
  const cleanupResult = await cleanupCommand;
  // do not fail on cleanup
  if (cleanupResult.error) console.error(cleanupResult.error);

  if (!existingPublish.includes(myGroup))
    await plugin.app.fileManager.processFrontMatter(
      file,
      (fm: Record<string, unknown>) => {
        fm.publishedToGroups = [...existingPublish, myGroup];
      },
    );
};
