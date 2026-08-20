import { setIcon } from "obsidian";
import type { ReactElement } from "react";

/**
 * Renders one of Obsidian's built-in icons. The host node is emptied first
 * because React reuses it across renders and `setIcon` appends rather than
 * replaces.
 */
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
