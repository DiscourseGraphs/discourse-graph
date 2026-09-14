import { useMemo, type ReactElement } from "react";
import { DiscourseNode } from "~/types";
import { getAllDiscourseNodeColors } from "~/utils/colorUtils";

/** Selected-type chips plus Clear, shown below the search input once a filter is active. */
export const NodeTypeFilterTags = ({
  focusSearchInput,
  nodeTypes,
  onSelectedNodeTypeIdsChange,
  selectedNodeTypeIds,
}: {
  // Removing a chip (or Clear, when it's the last one) unmounts the button the
  // click just focused; without somewhere to send focus, it falls back to
  // `document.body` and arrow-key result navigation stops responding.
  focusSearchInput: () => void;
  nodeTypes: DiscourseNode[];
  onSelectedNodeTypeIdsChange: (ids: string[]) => void;
  selectedNodeTypeIds: string[];
}): ReactElement | null => {
  const chipsById = useMemo(() => {
    const byId = new Map<
      string,
      { name: string; backgroundColor: string; textColor: string }
    >();
    getAllDiscourseNodeColors(nodeTypes).forEach(({ nodeType, colors }) => {
      byId.set(nodeType.id, {
        name: nodeType.name,
        backgroundColor: colors.backgroundColor,
        textColor: colors.textColor,
      });
    });
    return byId;
  }, [nodeTypes]);

  if (selectedNodeTypeIds.length === 0) return null;

  const removeType = (id: string): void => {
    onSelectedNodeTypeIdsChange(
      selectedNodeTypeIds.filter((selectedId) => selectedId !== id),
    );
    focusSearchInput();
  };

  return (
    <div className="border-modifier-border bg-secondary flex flex-wrap items-center gap-[var(--size-2-3)] border-b px-[var(--size-4-3)] py-[var(--size-4-2)]">
      {selectedNodeTypeIds.flatMap((id) => {
        const chip = chipsById.get(id);
        if (!chip) return [];
        return (
          <span
            key={id}
            style={{
              backgroundColor: chip.backgroundColor,
              color: chip.textColor,
            }}
            className="inline-flex items-center gap-[var(--size-4-1)] whitespace-nowrap rounded-full py-[var(--size-2-1)] pl-[var(--size-4-2)] pr-[var(--size-4-1)] text-[length:var(--font-ui-smaller)] font-semibold"
          >
            <span className="max-w-40 truncate">{chip.name}</span>
            {/* `clickable-icon`, because Obsidian's `button:not(.clickable-icon)` rule outranks a utility class and would paint its own box behind the ×.
                `shadow-none` also drops Obsidian's default focus box-shadow, so it's replaced with an explicit outline here. */}
            <button
              type="button"
              aria-label={`Remove ${chip.name} filter`}
              onClick={() => removeType(id)}
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
          onSelectedNodeTypeIdsChange([]);
          focusSearchInput();
        }}
        className="text-muted hover:text-normal text-[length:var(--font-ui-smaller)]"
      >
        Clear
      </button>
    </div>
  );
};
