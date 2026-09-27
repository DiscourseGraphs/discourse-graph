import type { App } from "obsidian";
import type { ReactElement } from "react";
import { SearchDropdown } from "~/components/SearchDropdown";
import { activateOnKey } from "~/utils/keyboardHints";

export const NodeDisplayOptionsMenu = ({
  app,
  isOpen,
  onOpenChange,
  onShowCandidatesChange,
  showCandidates,
}: {
  app: App;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onShowCandidatesChange: (showCandidates: boolean) => void;
  showCandidates: boolean;
}): ReactElement => {
  const toggle = (): void => onShowCandidatesChange(!showCandidates);

  return (
    <SearchDropdown
      app={app}
      ariaLabel="Display options"
      iconName="sliders-horizontal"
      isActive={showCandidates}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Display options"
    >
      <div
        role="menuitemcheckbox"
        aria-checked={showCandidates}
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(event) => activateOnKey(event, toggle)}
        onMouseDown={(event) => event.preventDefault()}
        className="text-normal hover:bg-modifier-hover flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
      >
        <span>Show candidate nodes</span>
        {/* Obsidian's own toggle chrome, so it matches the settings tab. */}
        <div
          aria-hidden
          className={`checkbox-container mod-small pointer-events-none ${
            showCandidates ? "is-enabled" : ""
          }`}
        />
      </div>
    </SearchDropdown>
  );
};
