import React from "react";
import ReactDOM from "react-dom";
import { OnloadArgs } from "roamjs-components/types";
import {
  Popover,
  Menu,
  MenuItem,
  Button,
  Intent,
  Position,
  PopoverInteractionKind,
} from "@blueprintjs/core";
import { FeedbackWidget } from "./BirdEatsBugs";

type DiscourseFloatingMenuProps = {
  // CSS placement class
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  theme: string; // e.g., "bp3-light" | "bp3-dark"
  buttonTheme?: string; // e.g., "bp3-light" | "bp3-dark"
};

const ANCHOR_ID = "dg-floating-menu-anchor";

export const DiscourseFloatingMenu = (props: DiscourseFloatingMenuProps) => (
  <div
    id="discourse-floating-menu"
    className={`${props.position} ${props.theme}`}
  >
    <Popover
      autoFocus={false}
      content={
        <Menu>
          <MenuItem
            text="Send feedback"
            icon="send-message"
            onClick={() => {
              try {
                (window.birdeatsbug as FeedbackWidget | undefined)?.trigger?.();
              } catch (error) {
                console.error("Failed to trigger feedback widget:", error);
              }
            }}
          />
          <MenuItem
            text="Docs"
            icon="document-open"
            href="https://discoursegraphs.com/docs/roam"
            rel="noopener noreferrer"
            target="_blank"
          />
          <MenuItem
            text="Community"
            icon="people"
            href="https://join.slack.com/t/discoursegraphs/shared_invite/zt-37xklatti-cpEjgPQC0YyKYQWPNgAkEg"
            rel="noopener noreferrer"
            target="_blank"
          />
        </Menu>
      }
      position={Position.TOP}
      className="bp3-popover-content-sizing"
      interactionKind={PopoverInteractionKind.HOVER}
      boundary="viewport"
      modifiers={{
        arrow: {
          enabled: false,
        },
      }}
    >
      <Button
        intent={Intent.PRIMARY}
        text="Discourse Graphs"
        id="dg-floating-menu-button"
        className={props.buttonTheme}
      />
    </Popover>
  </div>
);

export const hideDiscourseFloatingMenu = () => {
  const anchor = document.getElementById(ANCHOR_ID);
  anchor?.classList.add("hidden");
};

export const showDiscourseFloatingMenu = () => {
  const anchor = document.getElementById(ANCHOR_ID);
  anchor?.classList.remove("hidden");
};

export const installDiscourseFloatingMenu = (
  extensionAPI: OnloadArgs["extensionAPI"],
  props: DiscourseFloatingMenuProps = {
    position: "bottom-right",
    theme: "bp3-light",
    buttonTheme: "bp3-dark",
  },
) => {
  let floatingMenuAnchor = document.getElementById(ANCHOR_ID);
  if (!floatingMenuAnchor) {
    floatingMenuAnchor = document.createElement("div");
    floatingMenuAnchor.id = ANCHOR_ID;
    document.getElementById("app")?.appendChild(floatingMenuAnchor);
  }
  if (extensionAPI.settings.get("hide-feedback-button") as boolean) {
    floatingMenuAnchor.classList.add("hidden");
  }
  ReactDOM.render(
    <DiscourseFloatingMenu
      position={props.position}
      theme={props.theme}
      buttonTheme={props.buttonTheme}
    />,
    floatingMenuAnchor,
  );
};

export const removeDiscourseFloatingMenu = () => {
  const anchor = document.getElementById(ANCHOR_ID);
  if (anchor) {
    try {
      ReactDOM.unmountComponentAtNode(anchor);
    } catch (e) {
      // no-op: unmount best-effort
    }
    anchor.remove();
  }
};
