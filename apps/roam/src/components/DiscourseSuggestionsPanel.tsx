import { Alignment, Button, Card, Navbar, Classes } from "@blueprintjs/core";
import React from "react";

type DiscourseSuggestionsPanelProps = {
  onClose: () => void;
};

export const DiscourseSuggestionsPanel = ({
  onClose,
}: DiscourseSuggestionsPanelProps) => {
  return (
    <Card
      style={{
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: 0,
        height: "100%",
      }}
      className="roamjs-discourse-suggestions-panel"
    >
      <Navbar
        style={{
          borderBottom: "1px solid #d8e1e8",
          boxShadow: "none",
        }}
      >
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading
            style={{ fontSize: "14px", margin: 0, fontWeight: 600 }}
          >
            Suggested Discourse nodes
          </Navbar.Heading>
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <Button icon="cog" minimal={true} title="Settings" small={true} />
          <Button
            icon="cross"
            minimal={true}
            title="Close Panel"
            onClick={onClose}
            small={true}
          />
        </Navbar.Group>
      </Navbar>
      <div
        className={Classes.CARD}
        style={{ flexGrow: 1, overflowY: "auto", padding: "10px" }}
      >
        <p>Panel content goes here.</p>
      </div>
    </Card>
  );
};
