import { Notice, type FrontMatterCache, type TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { PublishGroupSuggestModal } from "~/components/PublishGroupSuggestModal";
import { getMyGroups, type MyGroup } from "~/utils/importNodes";
import { getLoggedInClient } from "~/utils/supabaseContext";
import { publishNode, publishNodeToGroup } from "~/utils/publishNode";
import { getAvailableGroupIds } from "~/utils/importNodes";
import { syncAllNodesAndRelations } from "~/utils/syncDgNodesToSupabase";

export type PublishGroupOption = MyGroup & {
  isPublished: boolean;
};

export const getPublishedToGroups = (
  frontmatter: FrontMatterCache | Record<string, unknown>,
): string[] => {
  const publishedToGroups = frontmatter.publishedToGroups as unknown;
  if (!Array.isArray(publishedToGroups)) return [];
  return publishedToGroups.filter((g): g is string => typeof g === "string");
};

export const loadPublishGroupOptions = async (
  plugin: DiscourseGraphPlugin,
): Promise<PublishGroupOption[]> => {
  const client = await getLoggedInClient(plugin);
  if (!client) {
    throw new Error("Cannot connect to database");
  }

  const groups = await getMyGroups(client);
  return groups.map((group) => ({ ...group, isPublished: false }));
};

export const withPublishedState = (
  groups: MyGroup[],
  publishedToGroups: string[],
): PublishGroupOption[] =>
  groups.map((group) => ({
    ...group,
    isPublished: publishedToGroups.includes(group.id),
  }));

export const publishNodeToSelectedGroup = async ({
  plugin,
  file,
  frontmatter,
  groupId,
}: {
  plugin: DiscourseGraphPlugin;
  file: TFile;
  frontmatter: FrontMatterCache | Record<string, unknown>;
  groupId: string;
}): Promise<void> => {
  const publishedToGroups = getPublishedToGroups(frontmatter);
  if (publishedToGroups.includes(groupId)) {
    throw new Error("Already shared with this group");
  }

  if (!frontmatter.nodeInstanceId) {
    throw new Error("Please sync the node first");
  }

  await publishNode({
    plugin,
    file,
    frontmatter: frontmatter as FrontMatterCache,
    groupId,
  });
};

export const publishNodeToAllGroups = async ({
  plugin,
  file,
  groupIds,
}: {
  plugin: DiscourseGraphPlugin;
  file: TFile;
  groupIds?: string[];
}): Promise<number> => {
  const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
  if (!frontmatter) {
    throw new Error("File metadata not available");
  }

  const client = await getLoggedInClient(plugin);
  if (!client) {
    throw new Error("Cannot connect to database");
  }

  const memberGroupIds = await getAvailableGroupIds(client);
  const existingPublish = getPublishedToGroups(frontmatter);
  const targetGroupIds =
    groupIds && groupIds.length > 0 ? groupIds : memberGroupIds;
  const toPublish = [
    ...new Set(
      targetGroupIds.filter(
        (groupId) =>
          memberGroupIds.includes(groupId) &&
          !existingPublish.includes(groupId),
      ),
    ),
  ];

  if (toPublish.length === 0) {
    return 0;
  }

  if (!frontmatter.nodeInstanceId) {
    throw new Error("Please sync the node first");
  }

  await syncAllNodesAndRelations(plugin);

  await Promise.all(
    toPublish.map((groupId) =>
      publishNodeToGroup({
        plugin,
        file,
        frontmatter: frontmatter as FrontMatterCache,
        myGroup: groupId,
        skipFrontmatterUpdate: true,
      }),
    ),
  );

  await plugin.app.fileManager.processFrontMatter(
    file,
    (fm: Record<string, unknown>) => {
      const current = getPublishedToGroups(fm);
      fm.publishedToGroups = [...new Set([...current, ...toPublish])];
    },
  );

  return toPublish.length;
};

export const openPublishGroupPicker = async ({
  plugin,
  file,
  frontmatter,
}: {
  plugin: DiscourseGraphPlugin;
  file: TFile;
  frontmatter: FrontMatterCache | Record<string, unknown>;
}): Promise<void> => {
  let groups: PublishGroupOption[];
  try {
    const myGroups = await loadPublishGroupOptions(plugin);
    groups = withPublishedState(myGroups, getPublishedToGroups(frontmatter));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    new Notice(message, 5000);
    return;
  }

  if (groups.length === 0) {
    new Notice("You are not a member of any groups", 5000);
    return;
  }

  new PublishGroupSuggestModal({
    app: plugin.app,
    groups,
    onSelect: async (group: PublishGroupOption) => {
      try {
        await publishNodeToSelectedGroup({
          plugin,
          file,
          frontmatter,
          groupId: group.id,
        });
        new Notice("Published successfully", 3000);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`Publish failed: ${message}`, 5000);
        console.error("Publish failed:", error);
      }
    },
  }).open();
};
