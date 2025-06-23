import { Button, Icon, Popover, Position, Tooltip } from "@blueprintjs/core";
import React, { useMemo } from "react";
import ReactDOM from "react-dom";
import { ContextContent } from "./DiscourseContext";
import useInViewport from "react-in-viewport/dist/es/lib/useInViewport";
import nanoid from "nanoid";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types/native";
import createBlock from "roamjs-components/writes/createBlock";
import { getBlockUidFromTarget } from "roamjs-components/dom";
import { DiscourseSuggestionsPanel } from "./DiscourseSuggestionsPanel";
import useSuggestionsDisplaySettings from "~/utils/useSuggestionsDisplayMode";
import SuggestionsBody from "./SuggestionsBody";
import { useDiscourseData } from "~/utils/useDiscourseData";

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
}: {
  tag: string;
  id: string;
  parentEl: HTMLElement;
}) => {
  const blockUid = useMemo(() => getBlockUidFromTarget(parentEl), [parentEl]);

  const { loading, results, refs, score, tagUid } = useDiscourseData(tag);

  // Determine how suggestions should be displayed
  const {
    split: splitEnabled,
    overlay: overlayEnabled,
    inline: inlineEnabled,
  } = useSuggestionsDisplaySettings();

  const toggleHighlight = (uid: string, on: boolean) => {
    document
      .querySelectorAll(`[data-dg-block-uid="${uid}"]`)
      .forEach((el) => el.classList.toggle("dg-highlight", on));
  };

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
          {overlayEnabled && (
            <div className="mt-4 border-t pt-4">
              <SuggestionsBody
                tag={tag}
                blockUid={blockUid}
                existingResults={results}
              />
            </div>
          )}
        </div>
      }
      target={
        <Button
          small
          id={id}
          {...{ "data-dg-block-uid": blockUid }}
          onMouseEnter={() => toggleHighlight(blockUid, true)}
          onMouseLeave={() => toggleHighlight(blockUid, false)}
          className={"roamjs-discourse-context-overlay"}
          style={{
            minHeight: "initial",
            paddingTop: ".25rem",
            paddingBottom: ".25rem",
          }}
          minimal
          disabled={loading}
        >
          <div className="flex items-center gap-1.5">
            <Icon icon={"diagram-tree"} />
            <span className="mr-1 leading-none">{score}</span>
            <Icon icon={"link"} />
            <span className="leading-none">{refs}</span>
            {splitEnabled && (
              <Tooltip
                content="Open suggestions panel"
                hoverOpenDelay={200}
                hoverCloseDelay={0}
                position={Position.RIGHT}
              >
                <Button
                  icon="panel-stats"
                  minimal
                  small
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    DiscourseSuggestionsPanel.toggle(tag, id, parentEl);
                  }}
                />
              </Tooltip>
            )}
            {inlineEnabled && (
              <Tooltip
                content="Insert inline suggestions"
                hoverOpenDelay={200}
                position={Position.RIGHT}
              >
                <Button
                  icon="insert"
                  minimal
                  small
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    await createBlock({
                      parentUid: blockUid,
                      order: Infinity,
                      node: {
                        text: `{{inline-suggestive-mode}}`,
                        children: [{ text: tag }],
                      },
                    });
                  }}
                />
              </Tooltip>
            )}
          </div>
        </Button>
      }
      position={Position.BOTTOM}
    />
  );
};

const Wrapper = ({ parent, tag }: { parent: HTMLElement; tag: string }) => {
  const id = useMemo(() => nanoid(), []);
  const { inViewport } = useInViewport(
    { current: parent },
    {},
    { disconnectOnLeave: false },
    {},
  );
  return inViewport ? (
    <DiscourseContextOverlay tag={tag} id={id} parentEl={parent} />
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
        <span className="mr-1">0</span>
        <Icon icon={"link"} />
        <span>0</span>
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
      <Wrapper tag={tag} parent={parent} />
    </ExtensionApiContextProvider>,
    parent,
  );
};

export default DiscourseContextOverlay;
