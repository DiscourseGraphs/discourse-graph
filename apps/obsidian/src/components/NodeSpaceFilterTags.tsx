import { useMemo, type ReactElement } from "react";
import type { SpaceOption } from "~/utils/remoteSpaceCandidates";

/** Selected-space chips plus Clear, shown below the search input once a space filter is active — mirrors `NodeTypeFilterTags`. */
export const NodeSpaceFilterTags = ({
  focusSearchInput,
  selectedSpaceIds,
  onSelectedSpaceIdsChange,
  spaces,
}: {
  // See `NodeTypeFilterTags`: removing a chip unmounts the button that was just
  // clicked, so focus needs somewhere to land or arrow-key navigation stops responding.
  focusSearchInput: () => void;
  selectedSpaceIds: string[];
  onSelectedSpaceIdsChange: (ids: string[]) => void;
  spaces: SpaceOption[];
}): ReactElement | null => {
  const nameById = useMemo(() => {
    const byId = new Map<string, string>();
    spaces.forEach((space) => byId.set(space.id, space.name));
    return byId;
  }, [spaces]);

  if (selectedSpaceIds.length === 0) return null;

  const removeSpace = (id: string): void => {
    onSelectedSpaceIdsChange(
      selectedSpaceIds.filter((selectedId) => selectedId !== id),
    );
    focusSearchInput();
  };

  return (
    <div className="border-modifier-border bg-secondary flex flex-wrap items-center gap-[var(--size-2-3)] border-b px-[var(--size-4-3)] py-[var(--size-4-2)]">
      {selectedSpaceIds.flatMap((id) => {
        const name = nameById.get(id);
        if (!name) return [];
        return (
          <span
            key={id}
            className="bg-modifier-hover text-muted inline-flex items-center gap-[var(--size-4-1)] whitespace-nowrap rounded-full py-[var(--size-2-1)] pl-[var(--size-4-2)] pr-[var(--size-4-1)] text-[length:var(--font-ui-smaller)] font-semibold"
          >
            <span className="max-w-40 truncate">{name}</span>
            <button
              type="button"
              aria-label={`Remove ${name} filter`}
              onClick={() => removeSpace(id)}
              className="clickable-icon !h-[var(--size-4-4)] !w-[var(--size-4-4)] !bg-transparent !p-0 !text-inherit !shadow-none hover:!opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              ×
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={() => {
          onSelectedSpaceIdsChange([]);
          focusSearchInput();
        }}
        className="text-muted hover:text-normal text-[length:var(--font-ui-smaller)]"
      >
        Clear
      </button>
    </div>
  );
};
