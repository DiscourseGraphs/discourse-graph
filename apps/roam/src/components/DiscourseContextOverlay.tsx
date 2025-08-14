// DiscourseContextOverlay.tsx
import { Button, Icon, Popover, Position, Tooltip } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { ContextContent } from "./DiscourseContext";
import useInViewport from "react-in-viewport/dist/es/lib/useInViewport";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import deriveDiscourseNodeAttribute from "~/utils/deriveDiscourseNodeAttribute";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import nanoid from "nanoid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import findDiscourseNode from "~/utils/findDiscourseNode";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types/native";
import { getBlockUidFromTarget } from "roamjs-components/dom";
import { useDiscourseData } from "~/utils/useDiscourseData";
import { PanelManager } from "./PanelManager";

type DiscourseData = {
  results: Awaited<ReturnType<typeof getDiscourseContextResults>>;
  refs: number;
};

const cache: {
  [tag: string]: DiscourseData;
} = {};

const DiscourseContextOverlay = ({
  tag,
  id,
  parentEl,
  onloadArgs,
}: {
  tag: string;
  id: string;
  parentEl: HTMLElement;
  onloadArgs: OnloadArgs;
}) => {
  const blockUid = useMemo(() => getBlockUidFromTarget(parentEl), [parentEl]);
  const { loading, score, refs, results, tagUid } = useDiscourseData(tag);
  const [isPanelOpen, setIsPanelOpen] = useState(() =>
    PanelManager.isOpen(tag),
  );

  // Subscribe to panel state changes
  useEffect(() => {
    const unsubscribe = PanelManager.subscribe((openTags) => {
      setIsPanelOpen(openTags.includes(tag));
    });
    return () => {
      unsubscribe();
    };
  }, [tag]);

  const toggleHighlight = useCallback(
    (on: boolean) => {
      console.log("toggleHighlight", blockUid, on);
      document
        .querySelectorAll(`[data-dg-block-uid="${blockUid}"]`)
        .forEach((el) => el.classList.toggle("dg-highlight", on));
    },
    [blockUid],
  );

  const handleTogglePanel = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      PanelManager.toggle(tag, blockUid, parentEl, onloadArgs);
    },
    [tag, blockUid, parentEl, onloadArgs],
  );

  return (
    <Popover
      autoFocus={false}
      content={
        <div
          className={`roamjs-discourse-context-popover relative max-w-3xl p-4 ${
            results.length === 0 ? "flex items-center justify-center" : ""
          }`}
        >
          <ContextContent uid={tagUid} results={results} />
        </div>
      }
      target={
        <Button
          small
          id={id}
          className={`roamjs-discourse-context-overlay ${
            loading ? "animate-pulse" : ""
          }`}
          {...{ "data-dg-block-uid": blockUid }}
          style={{
            minHeight: "initial",
            paddingTop: ".25rem",
            paddingBottom: ".25rem",
          }}
          minimal
          disabled={loading}
          onMouseEnter={() => toggleHighlight(true)}
          onMouseLeave={() => toggleHighlight(false)}
        >
          <div className="flex items-center gap-1.5">
            <Icon icon={"diagram-tree"} />
            <span className="mr-1 leading-none">{loading ? "-" : score}</span>
            <Icon icon={"link"} />
            <span className="leading-none">{loading ? "-" : refs}</span>
            <Tooltip
              content={
                isPanelOpen
                  ? "Close suggestions panel"
                  : "Open suggestions panel"
              }
              hoverOpenDelay={200}
              hoverCloseDelay={0}
              position={Position.RIGHT}
            >
              <Button
                icon={isPanelOpen ? "panel-table" : "panel-stats"}
                minimal
                small
                intent={isPanelOpen ? "primary" : "none"}
                onClick={handleTogglePanel}
              />
            </Tooltip>
          </div>
        </Button>
      }
      position={Position.BOTTOM}
    />
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
  const id = useMemo(() => nanoid(), []);
  const { inViewport } = useInViewport(
    { current: parent },
    {},
    { disconnectOnLeave: false },
    {},
  );
  return inViewport ? (
    <DiscourseContextOverlay
      tag={tag}
      id={id}
      parentEl={parent}
      onloadArgs={onloadArgs}
    />
  ) : (
    <Button
      small
      id={id}
      minimal
      className={"roamjs-discourse-context-overlay"}
      disabled={true}
    >
      <div className="flex items-center gap-1.5">
        <Icon icon={"diagram-tree"} />
        <span className="mr-1">-</span>
        <Icon icon={"link"} />
        <span>-</span>
      </div>
    </Button>
  );
};

export const render = ({
  tag,
  parent,
  onloadArgs,
}: {
  tag: string;
  parent: HTMLElement;
  onloadArgs: OnloadArgs;
}) => {
  parent.style.margin = "0 8px";
  parent.onmousedown = (e) => e.stopPropagation();
  ReactDOM.render(
    <ExtensionApiContextProvider {...onloadArgs}>
      <Wrapper tag={tag} parent={parent} onloadArgs={onloadArgs} />
    </ExtensionApiContextProvider>,
    parent,
  );
};

export default DiscourseContextOverlay;
