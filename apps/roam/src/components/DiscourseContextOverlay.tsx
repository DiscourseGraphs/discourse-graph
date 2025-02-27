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

type DiscourseData = {
  results: Awaited<ReturnType<typeof getDiscourseContextResults>>;
  refs: number;
};

const cache: {
  [title: string]: DiscourseData;
} = {};
const overlayQueue: {
  tag: string;
  callback: () => Promise<void>;
  start: number;
  queued: number;
  end: number;
  mid: number;
  id: string;
}[] = [];

const getOverlayInfo = (tag: string, id: string): Promise<DiscourseData> => {
  if (cache[tag]) return Promise.resolve(cache[tag]);
  const relations = getDiscourseRelations();
  const nodes = getDiscourseNodes(relations);

  return new Promise((resolve) => {
    const triggerNow = overlayQueue.length === 0;
    overlayQueue.push({
      id,
      start: 0,
      end: 0,
      mid: 0,
      queued: new Date().valueOf(),
      async callback() {
        const self = this;
        const start = (self.start = new Date().valueOf());
        // @ts-ignore
        const queryResult = await window.roamAlphaAPI.data.async.q(
          `[:find ?a :where [?b :node/title "${normalizePageTitle(
            tag,
          )}"] [?a :block/refs ?b]]`,
        );
        const refs = queryResult.length;
        return getDiscourseContextResults({
          uid: getPageUidByPageTitle(tag),
          nodes,
          relations,
        }).then(function resultCallback(results) {
          self.mid = new Date().valueOf();
          const output = (cache[tag] = {
            results,

            refs,
          });
          const runTime = (self.end = new Date().valueOf() - start);
          setTimeout(() => {
            overlayQueue.splice(0, 1);
            if (overlayQueue.length) {
              overlayQueue[0].callback();
            }
          }, runTime * 4);
          resolve(output);
        });
      },
      tag,
    });
    if (triggerNow) overlayQueue[0].callback?.();
  });
};

// const experimentalGetOverlayInfo = (title: string) =>
//   Promise.all([
//     getDiscourseContextResults({ uid: getPageUidByPageTitle(title) }),
//     fireWorkerQuery({
//       where: [
//         {
//           type: "data-pattern",
//           arguments: [
//             { type: "variable", value: "b" },
//             { type: "constant", value: ":node/title" },
//             { type: "constant", value: `"${title}"` },
//           ],
//         },
//         {
//           type: "data-pattern",
//           arguments: [
//             { type: "variable", value: "a" },
//             { type: "constant", value: ":block/refs" },
//             { type: "variable", value: `b` },
//           ],
//         },
//       ],
//       pull: [],
//     }),
//   ]).then(([results, allrefs]) => ({ results, refs: allrefs.length }));

export const refreshUi: { [k: string]: () => void } = {};
const refreshAllUi = () =>
  Object.entries(refreshUi).forEach(([k, v]) => {
    if (document.getElementById(k)) {
      v();
    } else {
      delete refreshUi[k];
    }
  });

const DiscourseContextOverlay = ({ tag, id }: { tag: string; id: string }) => {
  const tagUid = useMemo(() => getPageUidByPageTitle(tag), [tag]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<DiscourseData["results"]>([]);
  const [refs, setRefs] = useState(0);
  const [score, setScore] = useState<number | string>(0);
  const getInfo = useCallback(
    () =>
      // localStorageGet("experimental") === "true"
      // ? experimentalGetOverlayInfo(tag)
      // :
      getOverlayInfo(tag, id)
        .then(({ refs, results }) => {
          const discourseNode = findDiscourseNode(tagUid);
          if (discourseNode) {
            const attribute = getSettingValueFromTree({
              tree: getBasicTreeByParentUid(discourseNode.type),
              key: "Overlay",
              defaultValue: "Overlay",
            });
            return deriveDiscourseNodeAttribute({
              uid: tagUid,
              attribute,
            }).then((score) => {
              setResults(results);
              setRefs(refs);
              setScore(score);
            });
          }
        })
        .finally(() => setLoading(false)),
    [tag, setResults, setLoading, setRefs, setScore],
  );
  const refresh = useCallback(() => {
    setLoading(true);
    getInfo();
  }, [getInfo, setLoading]);
  useEffect(() => {
    refreshUi[id] = refresh;
    getInfo();
  }, [refresh, getInfo]);
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
    <DiscourseContextOverlay tag={tag} id={id} />
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
