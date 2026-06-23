import { Button } from "@blueprintjs/core";
import posthog from "posthog-js";
import React from "react";
import { handleTitleAdditions } from "~/utils/handleTitleAdditions";
import { openShareNodeDialog } from "~/utils/openShareNodeDialog";

const PUBLISH_TITLE_BUTTON_ATTRIBUTE = "data-roamjs-publish-node-title-button";

const PublishNodeTitleButton = ({
  uid,
  title,
  nodeType,
}: {
  uid: string;
  title: string;
  nodeType: string;
}): JSX.Element => (
  <Button
    text="Publish"
    icon="upload"
    minimal
    outlined
    onClick={() => {
      posthog.capture("Share Node: Page Title Button Triggered", {
        pageUid: uid,
        nodeType,
      });
      openShareNodeDialog({ uid, title, nodeType });
    }}
  />
);

export const renderPublishNodeTitleButton = ({
  h1,
  uid,
  title,
  nodeType,
}: {
  h1: HTMLHeadingElement;
  uid: string;
  title: string;
  nodeType: string;
}): void => {
  if (!uid) return;
  if (h1.getAttribute(PUBLISH_TITLE_BUTTON_ATTRIBUTE) === uid) return;

  h1.setAttribute(PUBLISH_TITLE_BUTTON_ATTRIBUTE, uid);
  handleTitleAdditions(
    h1,
    <PublishNodeTitleButton uid={uid} title={title} nodeType={nodeType} />,
    { layout: "inline" },
  );
};
