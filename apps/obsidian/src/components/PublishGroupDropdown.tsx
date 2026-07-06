import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import {
  getPublishedToGroups,
  getPublishToAllTitle,
  getUnpublishedGroups,
  loadMyGroups,
  notifyPublishError,
  publishToAllGroupsWithNotice,
  publishToSelectedGroupWithNotice,
  withPublishedState,
} from "~/utils/publishGroupSelection";
import type { MyGroup } from "@repo/database/lib/groups";

type PublishGroupDropdownProps = {
  plugin: DiscourseGraphPlugin;
  file: TFile;
};

export const PublishGroupDropdown = ({
  plugin,
  file,
}: PublishGroupDropdownProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, setMetadataVersion] = useState(0);

  const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
  const publishedToGroups = useMemo(
    () => (frontmatter ? getPublishedToGroups(frontmatter) : []),
    [frontmatter],
  );
  const groupsWithPublishedState = withPublishedState(
    groups,
    publishedToGroups,
  );
  const unpublishedGroups = getUnpublishedGroups(groupsWithPublishedState);

  useEffect(() => {
    const ref = plugin.app.metadataCache.on("changed", (changedFile) => {
      if (changedFile.path === file.path) {
        setMetadataVersion((version) => version + 1);
      }
    });

    return () => {
      plugin.app.metadataCache.offref(ref);
    };
  }, [plugin.app.metadataCache, file.path]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadGroups = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const myGroups = await loadMyGroups(plugin);
        if (!cancelled) {
          setGroups(myGroups);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
          setGroups([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadGroups();

    return () => {
      cancelled = true;
    };
  }, [plugin, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const runPublishAction = useCallback(
    async (action: () => Promise<void>, onSuccess?: () => void) => {
      if (isPublishing) return;

      setIsPublishing(true);
      try {
        await action();
        onSuccess?.();
      } catch (error) {
        notifyPublishError(error);
      } finally {
        setIsPublishing(false);
      }
    },
    [isPublishing],
  );

  const handlePublishToGroup = useCallback(
    (groupId: string) => {
      if (publishedToGroups.includes(groupId)) return;

      void runPublishAction(async () => {
        await publishToSelectedGroupWithNotice({ plugin, file, groupId });
        setIsOpen(false);
      });
    },
    [plugin, file, publishedToGroups, runPublishAction],
  );

  const handlePublishToAllGroups = useCallback(() => {
    if (isLoading || unpublishedGroups.length === 0) return;

    void runPublishAction(async () => {
      await publishToAllGroupsWithNotice({ plugin, file });
      setIsOpen(false);
    });
  }, [plugin, file, isLoading, unpublishedGroups.length, runPublishAction]);

  if (!frontmatter) {
    return null;
  }

  const publishedCount = publishedToGroups.length;
  const triggerLabel =
    publishedCount > 0 ? `Published (${publishedCount})` : "Publish";

  return (
    <div ref={containerRef} className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isLoading && isOpen}
        className={`rounded border px-2 py-1 text-xs ${
          publishedCount > 0
            ? "border-green-600 bg-green-200 text-green-800 dark:bg-green-900/60 dark:text-green-100"
            : "border border-gray-400 bg-gray-100 font-medium hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
        }`}
        title="Publish to a group"
      >
        {isPublishing ? "Publishing..." : triggerLabel}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 min-w-[12rem] rounded border border-gray-200 bg-white py-1 shadow-md dark:border-gray-600 dark:bg-gray-900">
          <div
            role="button"
            tabIndex={0}
            onClick={() => handlePublishToAllGroups()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handlePublishToAllGroups();
              }
            }}
            className={`border-b border-gray-200 px-3 py-1.5 text-xs font-medium dark:border-gray-600 ${
              isLoading || isPublishing || unpublishedGroups.length === 0
                ? "cursor-default text-gray-400 dark:text-gray-500"
                : "cursor-pointer text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
            }`}
            title={getPublishToAllTitle(unpublishedGroups.length)}
          >
            Publish to all groups
          </div>

          {isLoading && (
            <div className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
              Loading groups...
            </div>
          )}

          {loadError && (
            <div className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
              {loadError}
            </div>
          )}

          {!isLoading &&
            !loadError &&
            groupsWithPublishedState.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
                You are not a member of any groups.
              </div>
            )}

          {!isLoading &&
            !loadError &&
            groupsWithPublishedState.map((group) => (
              <button
                key={group.id}
                type="button"
                disabled={isPublishing || group.isPublished}
                onClick={() => handlePublishToGroup(group.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium ${
                  group.isPublished
                    ? "cursor-default opacity-80"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                title={
                  group.isPublished
                    ? "Already published to this group"
                    : `Publish to ${group.name}`
                }
              >
                <span className="inline-flex w-4 shrink-0 justify-center">
                  {group.isPublished ? "✓" : ""}
                </span>
                <span className="truncate">{group.name}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
