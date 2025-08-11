import React, { useState } from "react";
import ReactDOM from "react-dom";
import { Popover, Menu, MenuItem, Button, Position } from "@blueprintjs/core";

type DiscourseFloatingMenuProps = {
  position: string;
  theme: string;
};

export const DiscourseFloatingMenu = (props: DiscourseFloatingMenuProps) => (
  <div
    id="discourse-floating-menu"
    className={`${props.position} ${props.theme}`}
  >
    <Popover
      content={
        <Menu>
          <MenuItem
            text="Send feedback"
            icon="send-message"
            onClick={() => {
              try {
                window.birdeatsbug?.trigger?.();
              } catch (error) {
                console.error("Failed to trigger feedback widget:", error);
              }
            }}
          />
          <MenuItem
            text="Docs"
            href="https://discoursegraphs.com/docs"
            rel="noopener noreferrer"
            target="_blank"
          />
          <MenuItem
            text="Community"
            href="https://join.slack.com/t/discoursegraphs/shared_invite/zt-37xklatti-cpEjgPQC0YyKYQWPNgAkEg"
            rel="noopener noreferrer"
            target="_blank"
          />
        </Menu>
      }
      position={Position.RIGHT_TOP}
    >
      <Button text="Discourse Graph" className="bp3-intent-primary" />
    </Popover>
  </div>
);

const ANCHOR_ID = "dg-floating-menu-anchor";

export const installDiscourseFloatingMenu = (
  props: DiscourseFloatingMenuProps = {
    position: "bottom-right",
    theme: "bp3-dark",
  },
) => {
  let floatingMenuAnchor = document.getElementById(ANCHOR_ID);
  if (!floatingMenuAnchor) {
    floatingMenuAnchor = document.createElement("div");
    floatingMenuAnchor.id = ANCHOR_ID;
    document.getElementById("app")?.appendChild(floatingMenuAnchor);
  }
  ReactDOM.render(
    <DiscourseFloatingMenu position={props.position} theme={props.theme} />,
    floatingMenuAnchor,
  );
};

export const removeDiscourseFloatingMenu = () => {
  document.getElementById(ANCHOR_ID)?.remove();
};
