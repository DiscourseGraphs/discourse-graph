import type { FrontMatterCache, TFile } from "obsidian";
import type { default as DiscourseGraphPlugin } from "~/index";
import { getLoggedInClient, getSupabaseContext } from "./supabaseContext";
import { addFile } from "@repo/database/lib/files";
import mime from "mime-types";
import { DGSupabaseClient } from "@repo/database/lib/client";

const publishSchema = async ({
  client,
  spaceId,
  nodeTypeId,
  groupId,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  nodeTypeId: string;
  groupId: string;
}): Promise<void> => {
  // Check if schema exists
  const schemaResponse = await client
    .from("Concept")
    .select("source_local_id")
    .eq("space_id", spaceId)
    .eq("is_schema", true)
    .eq("source_local_id", nodeTypeId)
    .maybeSingle();

  if (schemaResponse.error) {
    console.error("Error checking schema existence:", schemaResponse.error);
    return; // Don't fail node publishing if schema check fails
  }

  if (!schemaResponse.data) {
    console.warn(
      `Schema with nodeTypeId ${nodeTypeId} not found in space ${spaceId}`,
    );
    return; // Schema doesn't exist, skip publishing
  }

  // Publish schema to group via ResourceAccess
  const publishResponse = await client.from("ResourceAccess").upsert(
    {
      /* eslint-disable @typescript-eslint/naming-convention */
      account_uid: groupId,
      source_local_id: nodeTypeId,
      space_id: spaceId,
      /* eslint-enable @typescript-eslint/naming-convention */
    },
    { ignoreDuplicates: true },
  );

  if (publishResponse.error && publishResponse.error.code !== "23505") {
    // 23505 is duplicate key, which counts as a success.
    console.error("Error publishing schema:", publishResponse.error);
    // Don't throw - schema publishing failure shouldn't block node publishing
  }
};

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
  const myGroupsResponse = await client
    .from("group_membership")
    .select("group_id");
  if (myGroupsResponse.error) throw myGroupsResponse.error;
  const myGroups = new Set(
    myGroupsResponse.data.map(({ group_id }) => group_id),
  );
  if (myGroups.size === 0) throw new Error("Cannot get group");
  const existingPublish =
    (frontmatter.publishedToGroups as undefined | string[]) || [];
  const commonGroups = existingPublish.filter((g) => myGroups.has(g));
  const myGroup = (commonGroups.length > 0 ? commonGroups : [...myGroups])[0]!;
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
  const lastModifiedDb = new Date(
    idResponse.data.last_modified + "Z",
  ).getTime();
  const embeds = plugin.app.metadataCache.getFileCache(file)?.embeds ?? [];
  const attachments = embeds
    .map(({ link }) => {
      const attachment = plugin.app.metadataCache.getFirstLinkpathDest(
        link,
        file.path,
      );
      if (attachment === null) {
        console.warn("Could not find file for " + link);
      }
      return attachment;
    })
    .filter((a) => !!a);
  const lastModified = Math.max(
    file.stat.mtime,
    ...attachments.map((a) => a.stat.mtime),
  );

  const skipPublishAccess =
    commonGroups.length > 0 && lastModified <= lastModifiedDb;

  if (!skipPublishAccess) {
    const publishSpaceResponse = await client.from("SpaceAccess").upsert(
      {
        /* eslint-disable @typescript-eslint/naming-convention */
        account_uid: myGroup,
        space_id: spaceId,
        /* eslint-enable @typescript-eslint/naming-convention */
        permissions: "partial",
      },
      { ignoreDuplicates: true },
    );
    if (
      publishSpaceResponse.error &&
      publishSpaceResponse.error.code !== "23505"
    )
      throw publishSpaceResponse.error;

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
      throw publishResponse.error;

    const nodeTypeId = frontmatter.nodeTypeId as string | undefined;
    if (nodeTypeId) {
      await publishSchema({
        client,
        spaceId,
        nodeTypeId,
        groupId: myGroup,
      });
    }
  }

  // Always sync non-text assets when node is published to this group
  const existingFiles: string[] = [];
  const existingReferencesReq = await client
    .from("FileReference")
    .select("*")
    .eq("space_id", spaceId)
    .eq("source_local_id", nodeId);
  if (existingReferencesReq.error) {
    console.error(existingReferencesReq.error);
    return;
  }
  const existingReferencesByPath = Object.fromEntries(
    existingReferencesReq.data.map((ref) => [ref.filepath, ref]),
  );

  for (const attachment of attachments) {
    const mimetype = mime.lookup(attachment.path) || "application/octet-stream";
    if (mimetype.startsWith("text/")) continue;
    existingFiles.push(attachment.path);
    const existingRef = existingReferencesByPath[attachment.path];
    if (
      !existingRef ||
      new Date(existingRef.last_modified + "Z").valueOf() <
        attachment.stat.mtime
    ) {
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

  if (commonGroups.length === 0)
    await plugin.app.fileManager.processFrontMatter(
      file,
      (fm: Record<string, unknown>) => {
        fm.publishedToGroups = [...existingPublish, myGroup];
      },
    );
};
