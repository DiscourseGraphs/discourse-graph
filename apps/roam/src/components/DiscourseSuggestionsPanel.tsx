import {
  Alignment,
  Card,
  Classes,
  Button,
  Navbar,
  Collapse,
} from "@blueprintjs/core";
import React, { useState, useCallback } from "react";

export const DiscourseSuggestionsPanel = ({
  tag,
  blockUid,
  onClose,
  // TODO: Will be used to pass setting to body renderer
  shouldGrabFromReferencedPages,
  shouldGrabParentChildContext,
}: {
  tag: string;
  blockUid: string;
  onClose: () => void;
  shouldGrabFromReferencedPages: boolean;
  shouldGrabParentChildContext: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleHighlight = useCallback(
    (on: boolean) => {
      document
        .querySelectorAll(`[data-dg-block-uid="${blockUid}"]`)
        .forEach((el) =>
          el.classList.toggle(
            "suggestive-mode-overlay-highlight-on-panel-hover",
            on,
          ),
        );
    },
    [blockUid],
  );

  return (
    <Card
      data-dg-block-uid={`${blockUid}`}
      onMouseEnter={() => toggleHighlight(true)}
      onMouseLeave={() => toggleHighlight(false)}
      className="discourse-suggestions-panel flex flex-col bg-white p-2"
    >
      <Navbar className="flex flex-nowrap items-center pl-2 pr-0 shadow-none">
        <Navbar.Group
          align={Alignment.LEFT}
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <Navbar.Heading className="cursor-pointer truncate text-base font-semibold">
            {tag}
          </Navbar.Heading>
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT} className="flex-0">
          <Button
            icon={isOpen ? "chevron-up" : "chevron-down"}
            minimal
            small
            onClick={() => setIsOpen((prev) => !prev)}
            title={isOpen ? "Collapse" : "Expand"}
          />
          <Button
            icon="cross"
            minimal={true}
            title="Close Panel"
            onClick={onClose}
            small={true}
          />
        </Navbar.Group>
      </Navbar>
      <Collapse
        isOpen={isOpen}
        keepChildrenMounted={true}
        transitionDuration={150}
      >
        <div className="flex-grow overflow-y-auto p-2">
          {/* TODO: Replace with actual body*/}
          <div>Body placeholder</div>
        </div>
      </Collapse>
    </Card>
  );
};
