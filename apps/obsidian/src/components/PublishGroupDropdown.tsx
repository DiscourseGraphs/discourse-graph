import { useCallback, useEffect, useRef, useState } from "react";
import { Notice, type TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import {
  getPublishedToGroups,
  loadPublishGroupOptions,
  publishNodeToAllGroups,
  publishNodeToSelectedGroup,
  withPublishedState,
} from "~/utils/publishGroupSelection";
import type { MyGroup } from "~/utils/importNodes";

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
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
  const publishedToGroups = frontmatter
    ? getPublishedToGroups(frontmatter)
    : [];
  const groupsWithPublishedState = withPublishedState(
    groups,
    publishedToGroups,
  );

  useEffect(() => {
    let cancelled = false;

    const loadGroups = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const myGroups = await loadPublishGroupOptions(plugin);
        if (!cancelled) {
          setGroups(myGroups);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setLoadError(message);
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
  }, [plugin, file.path]);

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

  const handlePublishToGroup = useCallback(
    async (groupId: string) => {
      const currentFrontmatter =
        plugin.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!currentFrontmatter) return;

      const currentPublished = getPublishedToGroups(currentFrontmatter);
      if (isPublishing || currentPublished.includes(groupId)) return;

      setIsPublishing(true);
      try {
        await publishNodeToSelectedGroup({
          plugin,
          file,
          frontmatter: currentFrontmatter,
          groupId,
        });
        new Notice("Published successfully", 3000);
        setIsOpen(false);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        new Notice(`Publish failed: ${errorMessage}`, 5000);
        console.error("Publish failed:", error);
      } finally {
        setIsPublishing(false);
      }
    },
    [plugin, file, isPublishing],
  );

  const unpublishedGroups = groupsWithPublishedState.filter(
    (group) => !group.isPublished,
  );

  const handlePublishToAllGroups = useCallback(async () => {
    if (isLoading || isPublishing || unpublishedGroups.length === 0) return;

    setIsPublishing(true);
    try {
      const publishedCount = await publishNodeToAllGroups({
        plugin,
        file,
      });
      if (publishedCount === 0) {
        new Notice("Already published to all groups", 3000);
      } else {
        new Notice(
          `Published to ${publishedCount} group${publishedCount === 1 ? "" : "s"}`,
          3000,
        );
        setIsOpen(false);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Publish failed: ${errorMessage}`, 5000);
      console.error("Publish failed:", error);
    } finally {
      setIsPublishing(false);
    }
  }, [plugin, file, isLoading, isPublishing, unpublishedGroups]);

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
        disabled={isLoading || !!loadError}
        className={`rounded border px-2 py-1 text-xs ${
          publishedCount > 0
            ? "border-green-600 bg-green-200 text-green-800 dark:bg-green-900/60 dark:text-green-300"
            : "border border-gray-400 bg-gray-100 font-medium hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
        }`}
        title="Publish to a group"
      >
        {isPublishing ? "Publishing..." : triggerLabel}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 min-w-[12rem] rounded border border-gray-200 bg-white py-1 shadow-md">
          <div
            role="button"
            tabIndex={0}
            onClick={() => void handlePublishToAllGroups()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void handlePublishToAllGroups();
              }
            }}
            className={`border-b border-gray-200 px-3 py-1.5 text-xs font-medium ${
              isLoading || isPublishing || unpublishedGroups.length === 0
                ? "cursor-default text-gray-400"
                : "cursor-pointer text-gray-900 hover:bg-gray-100"
            }`}
            title={
              unpublishedGroups.length === 0
                ? "Already published to all groups"
                : `Publish to ${unpublishedGroups.length} group${unpublishedGroups.length === 1 ? "" : "s"}`
            }
          >
            Publish to all groups
          </div>

          {isLoading && (
            <div className="px-3 py-2 text-xs text-gray-700">
              Loading groups...
            </div>
          )}

          {loadError && (
            <div className="px-3 py-2 text-xs text-gray-700">{loadError}</div>
          )}

          {!isLoading &&
            !loadError &&
            groupsWithPublishedState.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-700">
                You are not a member of any groups.
              </div>
            )}

          {!isLoading &&
            !loadError &&
            groupsWithPublishedState.map((group) => {
              const isPublished = group.isPublished;
              return (
                <button
                  key={group.id}
                  type="button"
                  disabled={isPublishing || isPublished}
                  onClick={() => void handlePublishToGroup(group.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium ${
                    isPublished
                      ? "cursor-default opacity-80"
                      : "hover:bg-gray-100"
                  }`}
                  title={
                    isPublished
                      ? "Already published to this group"
                      : `Publish to ${group.name}`
                  }
                >
                  <span className="inline-flex w-4 shrink-0 justify-center">
                    {isPublished ? "✓" : ""}
                  </span>
                  <span className="truncate">{group.name}</span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
};
