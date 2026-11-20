import React from "react";
import {
  Alignment,
  Button,
  Menu,
  Popover,
  Position,
  Switch,
} from "@blueprintjs/core";

type DisplayOptionsMenuProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onShowCandidatesChange: (showCandidates: boolean) => void;
  showCandidates: boolean;
};

// Escape must close only this menu: the dialog handles it while focus is in the
// search input, and the menu content stops it before it reaches the Dialog.
export const DisplayOptionsMenu = ({
  isOpen,
  onOpenChange,
  onShowCandidatesChange,
  showCandidates,
}: DisplayOptionsMenuProps): React.ReactElement => (
  <span className="inline-flex shrink-0">
    <Popover
      autoFocus={false}
      canEscapeKeyClose
      content={
        <Menu
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            onOpenChange(false);
          }}
        >
          <li
            className="px-2 py-1"
            onMouseDown={(event) => event.preventDefault()}
          >
            <Switch
              alignIndicator={Alignment.RIGHT}
              checked={showCandidates}
              className="mb-0 whitespace-nowrap"
              label="Show candidate nodes"
              onChange={(event) =>
                onShowCandidatesChange(event.currentTarget.checked)
              }
            />
          </li>
        </Menu>
      }
      enforceFocus={false}
      isOpen={isOpen}
      minimal
      onClose={() => onOpenChange(false)}
      onInteraction={(nextOpen, event) => {
        if (nextOpen) event?.stopPropagation();
        onOpenChange(nextOpen);
      }}
      position={Position.BOTTOM_RIGHT}
      usePortal
    >
      <Button
        active={isOpen || showCandidates}
        aria-expanded={isOpen}
        aria-label="Display options"
        icon="settings"
        minimal
        onMouseDown={(event) => event.preventDefault()}
        title="Display options"
      />
    </Popover>
  </span>
);
