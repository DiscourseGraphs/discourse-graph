import React, { useState } from "react";
import ReactDOM from "react-dom";
import { Popover, Menu, MenuItem, Button, Position } from "@blueprintjs/core";

export const DiscourseFloatingMenu = () => (
  <div id="discourse-floating-menu" className="bottom-right dark">
    <Popover
      content={
        <Menu>
          <MenuItem
            text="Send feedback"
            icon="send-message"
            onClick={window.birdeatsbug?.trigger}
          />
          <MenuItem
            text="Docs"
            href="https://discoursegraphs.com/docs"
            target="_blank"
          />
          <MenuItem
            text="Community"
            href="https://join.slack.com/t/discoursegraphs/shared_invite/zt-37xklatti-cpEjgPQC0YyKYQWPNgAkEg"
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

export const installDiscourseFloatingMenu = () => {
  let floatingMenuAnchor = document.getElementById(ANCHOR_ID);
  if (!floatingMenuAnchor) {
    floatingMenuAnchor = document.createElement("div");
    floatingMenuAnchor.id = ANCHOR_ID;
    document.getElementById("app")?.appendChild(floatingMenuAnchor);
  }
  ReactDOM.render(DiscourseFloatingMenu(), floatingMenuAnchor);
};

export const removeDiscourseFloatingMenu = () => {
  document.getElementById(ANCHOR_ID)?.remove();
};
