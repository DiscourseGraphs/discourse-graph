import {
  Alignment,
  Card,
  Classes,
  Button,
  Navbar,
  Collapse,
} from "@blueprintjs/core";
import React, { useState, useCallback, useEffect } from "react";
import SuggestionsBody from "./SuggestionsBody";

export const DiscourseSuggestionsPanel = ({
  tag,
  blockUid,
  isOpen: isOpenProp,
  onClose,
  onToggle,
}: {
  tag: string;
  blockUid: string;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (isOpen: boolean) => void;
}) => {
  const [isOpen, setIsOpen] = useState(isOpenProp);

  useEffect(() => {
    setIsOpen(isOpenProp);
  }, [isOpenProp]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      onToggle(next);
      return next;
    });
  }, [onToggle]);

  const toggleHighlight = useCallback(
    (on: boolean) => {
      document
        .querySelectorAll(`[suggestive-mode-overlay-button-uid="${blockUid}"]`)
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
      suggestive-mode-overlay-button-uid={blockUid}
      onMouseEnter={() => toggleHighlight(true)}
      onMouseLeave={() => toggleHighlight(false)}
      className="discourse-suggestions-panel flex flex-col bg-white p-2"
    >
      <Navbar className="flex flex-nowrap items-center pl-2 pr-0 shadow-none">
        <Navbar.Group
          align={Alignment.LEFT}
          className="min-w-0 flex-1 cursor-pointer"
          onClick={handleToggle}
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
            onClick={handleToggle}
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
          <SuggestionsBody tag={tag} blockUid={blockUid} />
        </div>
      </Collapse>
    </Card>
  );
};
