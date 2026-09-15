import { Button } from "@blueprintjs/core";
import posthog from "posthog-js";
import React, { useState } from "react";
import renderToast from "roamjs-components/components/Toast";
import { handleTitleAdditions } from "~/utils/handleTitleAdditions";
import { refreshImportedNode } from "~/utils/refreshImportedNode";

const REFRESH_TITLE_BUTTON_ATTRIBUTE =
  "data-roamjs-refresh-imported-node-title-button";

const RefreshImportedNodeTitleButton = ({
  uid,
}: {
  uid: string;
}): JSX.Element => {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      const result = await refreshImportedNode({ pageUid: uid, force: true });
      const failed = result.status === "failed";
      renderToast({
        id: failed
          ? "refresh-imported-node-failed"
          : "refresh-imported-node-success",
        intent: failed ? "danger" : result.warning ? "warning" : "success",
        content: result.warning
          ? `${result.message} ${result.warning}`
          : result.message,
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Button
      text="Refresh"
      icon="refresh"
      minimal
      outlined
      loading={refreshing}
      onClick={() => {
        posthog.capture("Refresh Imported Node: Page Title Button Triggered", {
          pageUid: uid,
        });
        void refresh();
      }}
    />
  );
};

export const renderRefreshImportedNodeTitleButton = ({
  h1,
  uid,
}: {
  h1: HTMLHeadingElement;
  uid: string;
}): void => {
  if (h1.getAttribute(REFRESH_TITLE_BUTTON_ATTRIBUTE) === uid) return;

  h1.setAttribute(REFRESH_TITLE_BUTTON_ATTRIBUTE, uid);
  handleTitleAdditions(h1, <RefreshImportedNodeTitleButton uid={uid} />);
};
