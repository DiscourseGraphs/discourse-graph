import type { FrontMatterCache, TFile } from "obsidian";
import { Notice } from "obsidian";
import type { default as DiscourseGraphPlugin } from "~/index";
import { getLoggedInClient, getSupabaseContext } from "./supabaseContext";
import { addFile } from "@repo/database/lib/files";
import mime from "mime-types";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  getRelationsForNodeInstanceId,
  getFileForNodeInstanceId,
  getFileForNodeInstanceIds,
  loadRelations,
  saveRelations,
} from "./relationsStore";
import type { RelationInstance } from "~/types";
import { getAvailableGroupIds } from "./importNodes";
import { syncAllNodesAndRelations } from "./syncDgNodesToSupabase";
import type { DiscourseNodeInVault } from "./getDiscourseNodes";
import type { SupabaseContext } from "./supabaseContext";
import type { TablesInsert } from "@repo/database/dbTypes";

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

const intersection = <T>(set1: Set<T>, set2: Set<T>): Set<T> => {
  // @ts-expect-error - Set.intersection is ES2025 feature
  if (set1.intersection) return set1.intersection(set2); // eslint-disable-line
  const r: Set<T> = new Set();
  for (const x of set1) {
    if (set2.has(x)) r.add(x);
  }
  return r;
};

const difference = <T>(set1: Set<T>, set2: Set<T>): Set<T> => {
  // @ts-expect-error - Set.difference is ES2025 feature
  if (set1.difference) return set1.difference(set2); // eslint-disable-line
  const result = new Set(set1);
  if (set1.size <= set2.size)
    for (const e of set1) {
      if (set2.has(e)) result.delete(e);
    }
  else
    for (const e of set2) {
      if (result.has(e)) result.delete(e);
    }
  return result;
};

export const publishNewRelation = async (
  plugin: DiscourseGraphPlugin,
  relation: RelationInstance,
): Promise<boolean> => {
  const client = await getLoggedInClient(plugin);
  if (!client) throw new Error("Cannot get client");
  const context = await getSupabaseContext(plugin);
  if (!context) throw new Error("Cannot get context");
  const sourceFile = getFileForNodeInstanceId(plugin, relation.source);
  const destinationFile = getFileForNodeInstanceId(
    plugin,
    relation.destination,
  );
  if (!sourceFile || !destinationFile) return false;
  const sourceFm =
    plugin.app.metadataCache.getFileCache(sourceFile)?.frontmatter;
  const destinationFm =
    plugin.app.metadataCache.getFileCache(destinationFile)?.frontmatter;
  if (!sourceFm || !destinationFm) return false;

  const sourceGroups = sourceFm.publishedToGroups as string[] | undefined;
  const destinationGroups = destinationFm.publishedToGroups as
    | string[]
    | undefined;
  if (!Array.isArray(sourceGroups) || !Array.isArray(destinationGroups))
    return false;
  const relationTriples = plugin.settings.discourseRelations ?? [];
  const triple = relationTriples.find(
    (triple) =>
      triple.relationshipTypeId === relation.type &&
      triple.sourceId === sourceFm.nodeTypeId &&
      triple.destinationId === destinationFm.nodeTypeId,
  );
  if (!triple) return false;
  const resourceIds = [relation.id, relation.type, triple.id];
  const myGroups = await getAvailableGroupIds(client);
  const targetGroups = intersection(
    new Set(myGroups),
    intersection(
      new Set<string>(sourceGroups),
      new Set<string>(destinationGroups),
    ),
  );
  if (!targetGroups.size) return false;
  // in that case, sync all relations (only) before publishing
  await syncAllNodesAndRelations(plugin, context, true);
  const entries = [];
  for (const group of targetGroups) {
    for (const id of resourceIds) {
      entries.push({
        /* eslint-disable @typescript-eslint/naming-convention */
        account_uid: group,
        source_local_id: id,
        space_id: context.spaceId,
        /* eslint-enable @typescript-eslint/naming-convention */
      });
    }
  }
  const publishResponse = await client
    .from("ResourceAccess")
    .upsert(entries, { ignoreDuplicates: true });
  if (publishResponse.error && publishResponse.error.code !== "23505")
    throw publishResponse.error;
  relation.publishedToGroupId = [
    ...new Set([
      ...(relation.publishedToGroupId || []),
      ...targetGroups.values(),
    ]).values(),
  ];
  return true;
};

export const publishNodeRelations = async ({
  plugin,
  client,
  nodeId,
  myGroup,
  spaceId,
}: {
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
  nodeId: string;
  myGroup: string;
  spaceId: number;
}): Promise<void> => {
  const relations = await getRelationsForNodeInstanceId(plugin, nodeId);
  const resourceIds: Set<string> = new Set();
  const relationTriples = plugin.settings.discourseRelations ?? [];
  const relevantNodeIds: Set<string> = new Set();
  relations.map((relation) => {
    relevantNodeIds.add(relation.source);
    relevantNodeIds.add(relation.destination);
  });
  const relevantNodeFiles = getFileForNodeInstanceIds(plugin, relevantNodeIds);
  const relevantNodeTypeById: Record<string, string | undefined> = {};
  Object.entries(relevantNodeFiles).map(([id, file]: [string, TFile]) => {
    const fm = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
    if (fm === undefined) return;
    if (fm.nodeInstanceId !== nodeId) {
      // check if published to same group.
      // Note: current node's pub status not in cache yet!
      if (!Array.isArray(fm.publishedToGroups)) return;
      const publishedToGroups: string[] =
        (fm.publishedToGroups as string[]) || [];
      if (!publishedToGroups.includes(myGroup)) return;
    }
    relevantNodeTypeById[id] = fm.nodeTypeId as string;
  });
  relations.map((relation) => {
    if ((relation.publishedToGroupId ?? []).includes(myGroup)) return;
    const triple = relationTriples.find(
      (triple) =>
        triple.relationshipTypeId === relation.type &&
        triple.sourceId === relevantNodeTypeById[relation.source] &&
        triple.destinationId === relevantNodeTypeById[relation.destination],
    );
    if (triple) {
      resourceIds.add(relation.id);
      resourceIds.add(relation.type);
      resourceIds.add(triple.id);
    }
  });
  if (resourceIds.size === 0) return;
  const publishResponse = await client.from("ResourceAccess").upsert(
    [...resourceIds.values()].map((sourceLocalId: string) => ({
      /* eslint-disable @typescript-eslint/naming-convention */
      account_uid: myGroup,
      source_local_id: sourceLocalId,
      space_id: spaceId,
      /* eslint-enable @typescript-eslint/naming-convention */
    })),
    { ignoreDuplicates: true },
  );
  if (publishResponse.error && publishResponse.error.code !== "23505")
    throw publishResponse.error;
  const relData = await loadRelations(plugin);
  let dataChanged = false;
  relations
    .filter((rel) => resourceIds.has(rel.id))
    .map((rel) => {
      const savedRel = relData.relations[rel.id];
      if (!savedRel) return;
      const publishedTo = savedRel.publishedToGroupId;
      if (!publishedTo) {
        savedRel.publishedToGroupId = [myGroup];
        dataChanged = true;
      } else if (!publishedTo.includes(myGroup)) {
        publishedTo.push(myGroup);
        dataChanged = true;
      }
    });
  if (dataChanged) await saveRelations(plugin, relData);
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
  const client = await getLoggedInClient(plugin);
  if (!client) throw new Error("Cannot get client");
  const myGroups = new Set(await getAvailableGroupIds(client));
  if (myGroups.size === 0) throw new Error("Cannot get group");
  const existingPublish =
    (frontmatter.publishedToGroups as undefined | string[]) || [];
  const commonGroups = existingPublish.filter((g) => myGroups.has(g));
  // temporary single-group assumption
  const myGroup = (commonGroups.length > 0 ? commonGroups : [...myGroups])[0]!;
  return await publishNodeToGroup({ plugin, file, frontmatter, myGroup });
};

export const ensurePublishedRelationsAccuracy = async ({
  client,
  context,
  allNodesById,
  relationInstances,
}: {
  client: DGSupabaseClient;
  context: SupabaseContext;
  allNodesById: Record<string, DiscourseNodeInVault>;
  relationInstances: RelationInstance[];
}): Promise<void> => {
  const myGroups = await getAvailableGroupIds(client);
  const syncedRelationIdsResult = await client
    .from("Concept")
    .select("source_local_id")
    .eq("space_id", context.spaceId)
    .eq("is_schema", false)
    .gt("arity", 0);
  if (syncedRelationIdsResult.error) {
    console.error(
      "Could not get synced relation ids",
      syncedRelationIdsResult.error,
    );
    return;
  }
  const syncedRelationIds = new Set(
    (syncedRelationIdsResult.data || []).map((x) => x.source_local_id!),
  );
  // Also a good time to look at orphan relations
  const existingRelationIds = new Set(relationInstances.map((r) => r.id));
  const orphanRelationIds = difference(syncedRelationIds, existingRelationIds);
  if (orphanRelationIds.size) {
    const r = await client
      .from("Concept")
      .delete()
      .eq("space_id", context.spaceId)
      .in("source_local_id", [...orphanRelationIds]);
    if (!r.error) {
      for (const id of orphanRelationIds) {
        syncedRelationIds.delete(id);
      }
    }
  }
  const missingPublishRecords: TablesInsert<"ResourceAccess">[] = [];
  for (const group of myGroups) {
    const publishableRelations = relationInstances.filter(
      (r) =>
        !r.importedFromRid &&
        (
          (allNodesById[r.source]?.frontmatter?.publishedToGroups as
            | string[]
            | undefined) || []
        ).indexOf(group) >= 0 &&
        (
          (allNodesById[r.destination]?.frontmatter?.publishedToGroups as
            | string[]
            | undefined) || []
        ).indexOf(group) >= 0,
    );
    const publishableRelationIds = new Set(
      publishableRelations.map((x) => x.id),
    );
    const publishedIds = await client
      .from("ResourceAccess")
      .select("source_local_id")
      .eq("account_uid", group)
      .eq("space_id", context.spaceId);
    if (publishedIds.error) {
      console.error("Could not get synced relation ids", publishedIds.error);
      continue;
    }
    const publishedRelationIds = intersection(
      syncedRelationIds,
      new Set((publishedIds.data || []).map((x) => x.source_local_id)),
    );
    const missingPublishableIds = difference(
      publishableRelationIds,
      publishedRelationIds,
    );
    if (missingPublishableIds.size > 0) {
      missingPublishRecords.push(
        /* eslint-disable @typescript-eslint/naming-convention */
        ...[...missingPublishableIds].map((source_local_id) => ({
          source_local_id,
          space_id: context.spaceId,
          account_uid: group,
        })),
        /* eslint-enable @typescript-eslint/naming-convention */
      );
    }
    const extraPublishableIds = difference(
      publishedRelationIds,
      publishableRelationIds,
    );
    if (extraPublishableIds.size > 0) {
      const r = await client
        .from("ResourceAccess")
        .delete()
        .eq("account_uid", group)
        .eq("space_id", context.spaceId)
        .in("source_local_id", [...extraPublishableIds]);
      if (r.error) console.error(r.error);
    }
  }
  if (missingPublishRecords.length > 0) {
    const r = await client.from("ResourceAccess").upsert(missingPublishRecords);
    if (r.error) console.error(r.error);
  }
};

export const publishNodeToGroup = async ({
  plugin,
  file,
  frontmatter,
  myGroup,
}: {
  plugin: DiscourseGraphPlugin;
  file: TFile;
  frontmatter: FrontMatterCache;
  myGroup: string;
}): Promise<void> => {
  const nodeId = frontmatter.nodeInstanceId as string | undefined;
  if (!nodeId) throw new Error("Please sync the node first");
  const context = await getSupabaseContext(plugin);
  if (!context) throw new Error("Cannot get context");
  const spaceId = context.spaceId;
  const client = await getLoggedInClient(plugin);
  if (!client) throw new Error("Cannot get client");
  const existingPublish =
    (frontmatter.publishedToGroups as undefined | string[]) || [];

  const idResponse = await client
    .from("my_contents")
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
  try {
    await publishNodeRelations({ plugin, client, nodeId, myGroup, spaceId });
  } catch (error) {
    // do not fail to publish node for that reason
    console.error("Could not publish relations", error);
  }
  const embeds = plugin.app.metadataCache.getFileCache(file)?.embeds ?? [];
  const attachments = embeds
    .map(({ link }) => {
      const attachment = plugin.app.metadataCache.getFirstLinkpathDest(
        link,
        file.path,
      );
      return attachment;
    })
    .filter((a) => !!a);
  const lastModified = Math.max(
    file.stat.mtime,
    ...attachments.map((a) => a.stat.mtime),
  );

  const skipPublishAccess =
    existingPublish.includes(myGroup) && lastModified <= lastModifiedDb;

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
    .from("my_file_references")
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
    // Do not use standard upload for large files
    if (attachment.stat.size >= 6 * 1024 * 1024) {
      new Notice(
        `Asset file ${attachment.path} is larger than 6Mb and will not be uploaded`,
      );
      continue;
    }
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

  if (!existingPublish.includes(myGroup))
    await plugin.app.fileManager.processFrontMatter(
      file,
      (fm: Record<string, unknown>) => {
        fm.publishedToGroups = [...existingPublish, myGroup];
      },
    );
};
