import { Button, Tooltip } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import useInViewport from "react-in-viewport/dist/es/lib/useInViewport";
import { OnloadArgs } from "roamjs-components/types/native";
import { getBlockUidFromTarget } from "roamjs-components/dom";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { panelManager, subscribeToPanelState } from "./PanelManager";
import { ICON_SIZE } from "./DiscourseContextOverlay";

const SuggestiveModeOverlay = ({
  tag,
  parentEl,
  onloadArgs,
}: {
  tag: string;
  parentEl: HTMLElement;
  onloadArgs: OnloadArgs;
}) => {
  const blockUid = useMemo(() => getBlockUidFromTarget(parentEl), [parentEl]);
  const [isPanelOpen, setIsPanelOpen] = useState(() =>
    panelManager.isOpen(tag),
  );
  useEffect(() => {
    const unsubscribe = subscribeToPanelState(tag, setIsPanelOpen);
    return unsubscribe;
  }, [tag]);

  const toggleHighlight = useCallback(
    (on: boolean) => {
      const nodes = document.querySelectorAll(
        `[suggestive-mode-overlay-button-uid="${blockUid}"]`,
      );
      nodes.forEach((el) => {
        const elem = el as HTMLElement;
        if (
          elem.classList.contains("suggestive-mode-overlay") ||
          elem.closest(".suggestive-mode-overlay")
        )
          return;
        elem.classList.toggle(
          "suggestive-mode-overlay-highlight-on-panel-hover",
          on,
        );
      });
    },
    [blockUid],
  );

  const handleTogglePanel = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      toggleHighlight(false);
      panelManager.toggle({ tag, blockUid, onloadArgs });
    },
    [tag, blockUid, onloadArgs, toggleHighlight],
  );

  return (
    <div className="suggestive-mode-overlay max-w-3xl items-center">
      <Button
        data-dg-role="panel-toggle"
        data-dg-tag={tag}
        suggestive-mode-overlay-button-uid={blockUid}
        icon={isPanelOpen ? "panel-table" : "panel-stats"}
        style={{ fontSize: ICON_SIZE }}
        minimal
        small
        intent={isPanelOpen ? "primary" : "none"}
        onClick={handleTogglePanel}
        onMouseEnter={() => toggleHighlight(true)}
        onMouseLeave={() => toggleHighlight(false)}
      />
    </div>
  );
};

const Wrapper = ({
  parent,
  tag,
  onloadArgs,
}: {
  parent: HTMLElement;
  tag: string;
  onloadArgs: OnloadArgs;
}) => {
  const { inViewport } = useInViewport(
    { current: parent },
    {},
    { disconnectOnLeave: false },
    {},
  );
  return inViewport ? (
    <SuggestiveModeOverlay
      tag={tag}
      parentEl={parent}
      onloadArgs={onloadArgs}
    />
  ) : null;
};

export const renderSuggestive = ({
  tag,
  parent,
  onloadArgs,
}: {
  tag: string;
  parent: HTMLElement;
  onloadArgs: OnloadArgs;
}) => {
  parent.style.margin = "0 8px";
  parent.style.display = "inline-block";
  parent.onmousedown = (e) => e.stopPropagation();
  ReactDOM.render(
    <ExtensionApiContextProvider {...onloadArgs}>
      <Wrapper tag={tag} parent={parent} onloadArgs={onloadArgs} />
    </ExtensionApiContextProvider>,
    parent,
  );
};

export default SuggestiveModeOverlay;
