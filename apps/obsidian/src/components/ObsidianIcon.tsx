import { setIcon } from "obsidian";
import type { ReactElement } from "react";

/** Obsidian icon; the node is emptied first because `setIcon` appends and React reuses it. */
export const ObsidianIcon = ({
  name,
  className = "flex items-center",
}: {
  name: string;
  className?: string;
}): ReactElement => (
  <span
    className={className}
    ref={(el) => {
      if (!el) return;
      el.empty();
      setIcon(el, name);
    }}
  />
);
