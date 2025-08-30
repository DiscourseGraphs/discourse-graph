import {
  Alignment,
  Card,
  Classes,
  Button,
  Navbar,
  Collapse,
} from "@blueprintjs/core";
import React, { useState, useCallback } from "react";
import SuggestionsBody from "./SuggestionsBody";
import { useDiscourseData } from "~/utils/useDiscourseData";

export const DiscourseSuggestionsPanel = ({
  tag,
  blockUid,
  onClose,
}: {
  tag: string;
  blockUid: string;
  onClose: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const { results, loading } = useDiscourseData(tag);

  const toggleHighlight = useCallback(
    (on: boolean) => {
      document
        .querySelectorAll(`[data-dg-block-uid="${blockUid}"]`)
        .forEach((el) => el.classList.toggle("dg-highlight", on));
    },
    [blockUid],
  );

  return (
    <Card
      {...{ "data-dg-block-uid": blockUid }}
      style={{
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "8px",
      }}
      onMouseEnter={() => toggleHighlight(true)}
      onMouseLeave={() => toggleHighlight(false)}
      className="discourse-suggestions-panel"
    >
      <Navbar
        style={{
          borderBottom: "1px solid #d8e1e8",
          boxShadow: "none",
          paddingRight: 0,
          display: "flex",
          flexWrap: "nowrap",
          alignItems: "center",
        }}
      >
        <Navbar.Group align={Alignment.LEFT} style={{ flex: 1, minWidth: 0 }}>
          <Navbar.Heading
            className="truncate"
            style={{
              fontSize: "13px",
              margin: 0,
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => setIsOpen((prev) => !prev)}
          >
            {tag}
          </Navbar.Heading>
        </Navbar.Group>
        <Navbar.Group
          align={Alignment.RIGHT}
          style={{
            marginRight: "5px",
            flexShrink: 0,
            display: "flex",
            gap: "4px",
          }}
        >
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
        <div
          className={Classes.CARD}
          style={{ flexGrow: 1, overflowY: "auto", padding: "6px" }}
        >
          <SuggestionsBody
            tag={tag}
            blockUid={blockUid}
            existingResults={results}
            loading={loading}
          />
        </div>
      </Collapse>
    </Card>
  );
};
