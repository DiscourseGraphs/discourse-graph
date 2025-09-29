import { Button, Tooltip } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import useInViewport from "react-in-viewport/dist/es/lib/useInViewport";
import { OnloadArgs } from "roamjs-components/types/native";
import { getBlockUidFromTarget } from "roamjs-components/dom";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { panelManager, subscribeToPanelState } from "./PanelManager";

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
        `[data-dg-block-uid="${blockUid}"]`,
      );
      nodes.forEach((el) => {
        const elem = el as HTMLElement;
        if (
          elem.classList.contains("suggestive-mode-overlay") ||
          elem.closest(".suggestive-mode-overlay")
        )
          return;
        elem.classList.toggle("dg-highlight", on);
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
    <div className="suggestive-mode-overlay flex max-w-3xl">
      <Tooltip
        content={
          isPanelOpen ? "Close suggestions panel" : "Open suggestions panel"
        }
        hoverOpenDelay={200}
      >
        <Button
          data-dg-role="panel-toggle"
          data-dg-tag={tag}
          data-dg-block-uid={blockUid}
          icon={isPanelOpen ? "panel-table" : "panel-stats"}
          minimal
          small
          intent={isPanelOpen ? "primary" : "none"}
          onClick={handleTogglePanel}
          onMouseEnter={() => toggleHighlight(true)}
          onMouseLeave={() => toggleHighlight(false)}
        />
      </Tooltip>
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
