import { Notice, type FrontMatterCache, type TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { PublishGroupSuggestModal } from "~/components/PublishGroupSuggestModal";
import {
  getAvailableGroupIds,
  getMyGroups,
  type MyGroup,
} from "~/utils/importNodes";
import { getLoggedInClient } from "~/utils/supabaseContext";
import {
  getPublishedToGroups,
  publishNode,
  publishNodeToGroup,
} from "~/utils/publishNode";
import { syncAllNodesAndRelations } from "~/utils/syncDgNodesToSupabase";

export type PublishGroupOption = MyGroup & {
  isPublished: boolean;
};

export const PUBLISH_TO_ALL_ITEM_ID = "__publish_to_all_groups__";

export type PublishGroupSuggestItem = PublishGroupOption & {
  isPublishToAll?: boolean;
};

export { getPublishedToGroups };

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const notifyPublishError = (error: unknown): void => {
  new Notice(`Publish failed: ${getErrorMessage(error)}`, 5000);
  console.error("Publish failed:", error);
};

export const getUnpublishedGroups = (
  groups: PublishGroupOption[],
): PublishGroupOption[] => groups.filter((group) => !group.isPublished);

export const getPublishToAllTitle = (unpublishedCount: number): string =>
  unpublishedCount === 0
    ? "Already published to all groups"
    : `Publish to ${unpublishedCount} group${unpublishedCount === 1 ? "" : "s"}`;

export const buildPublishGroupPickerItems = (
  groups: PublishGroupOption[],
): PublishGroupSuggestItem[] => {
  const unpublishedGroups = getUnpublishedGroups(groups);
  return [
    {
      id: PUBLISH_TO_ALL_ITEM_ID,
      name: "Publish to all groups",
      isPublished: unpublishedGroups.length === 0,
      isPublishToAll: true,
    },
    ...groups,
  ];
};

export const isPublishToAllItem = (
  item: PublishGroupSuggestItem,
): item is PublishGroupSuggestItem & { isPublishToAll: true } =>
  item.isPublishToAll === true;

export const loadMyGroups = async (
  plugin: DiscourseGraphPlugin,
): Promise<MyGroup[]> => {
  const client = await getLoggedInClient(plugin);
  if (!client) {
    throw new Error("Cannot connect to database");
  }
  return getMyGroups(client);
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
}: {
  plugin: DiscourseGraphPlugin;
  file: TFile;
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
  const toPublish = memberGroupIds.filter(
    (groupId) => !existingPublish.includes(groupId),
  );

  if (toPublish.length === 0) {
    return 0;
  }

  if (!frontmatter.nodeInstanceId) {
    throw new Error("Please sync the node first");
  }

  await syncAllNodesAndRelations(plugin);

  for (const groupId of toPublish) {
    await publishNodeToGroup({
      plugin,
      file,
      frontmatter,
      myGroup: groupId,
      skipFrontmatterUpdate: true,
    });
  }

  await plugin.app.fileManager.processFrontMatter(
    file,
    (fm: Record<string, unknown>) => {
      const current = getPublishedToGroups(fm);
      fm.publishedToGroups = [...new Set([...current, ...toPublish])];
    },
  );

  return toPublish.length;
};

export const publishToSelectedGroupWithNotice = async ({
  plugin,
  file,
  groupId,
}: {
  plugin: DiscourseGraphPlugin;
  file: TFile;
  groupId: string;
}): Promise<void> => {
  const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
  if (!frontmatter) {
    throw new Error("File metadata not available");
  }

  await publishNodeToSelectedGroup({
    plugin,
    file,
    frontmatter,
    groupId,
  });
  new Notice("Published successfully", 3000);
};

export const publishToAllGroupsWithNotice = async ({
  plugin,
  file,
}: {
  plugin: DiscourseGraphPlugin;
  file: TFile;
}): Promise<void> => {
  const publishedCount = await publishNodeToAllGroups({ plugin, file });
  if (publishedCount === 0) {
    new Notice("Already published to all groups", 3000);
    return;
  }
  new Notice(
    `Published to ${publishedCount} group${publishedCount === 1 ? "" : "s"}`,
    3000,
  );
};

export const openPublishGroupPicker = async ({
  plugin,
  file,
}: {
  plugin: DiscourseGraphPlugin;
  file: TFile;
}): Promise<void> => {
  let groups: PublishGroupOption[];
  try {
    const myGroups = await loadMyGroups(plugin);
    const frontmatter =
      plugin.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    groups = withPublishedState(myGroups, getPublishedToGroups(frontmatter));
  } catch (error) {
    new Notice(getErrorMessage(error), 5000);
    return;
  }

  if (groups.length === 0) {
    new Notice("You are not a member of any groups", 5000);
    return;
  }

  new PublishGroupSuggestModal({
    app: plugin.app,
    items: buildPublishGroupPickerItems(groups),
    onChoose: async (item: PublishGroupSuggestItem) => {
      try {
        if (isPublishToAllItem(item)) {
          await publishToAllGroupsWithNotice({ plugin, file });
          return;
        }
        if (item.isPublished) {
          return;
        }
        await publishToSelectedGroupWithNotice({
          plugin,
          file,
          groupId: item.id,
        });
      } catch (error) {
        notifyPublishError(error);
      }
    },
  }).open();
};
