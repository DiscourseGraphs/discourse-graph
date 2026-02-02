import {
  Button,
  Icon,
  Popover,
  Position,
  Collapse,
  Card,
} from "@blueprintjs/core";
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
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";

type DiscourseData = {
  results: Awaited<ReturnType<typeof getDiscourseContextResults>>;
  refs: number;
};

const cache: {
  [tag: string]: DiscourseData;
} = {};

const getOverlayInfo = async (
  tag: string,
  ignoreCache?: boolean,
): Promise<DiscourseData> => {
  try {
    if (ignoreCache) delete cache[tag];
    if (cache[tag]) return cache[tag];

    const relations = getDiscourseRelations();
    const nodes = getDiscourseNodes(relations);

    const [results, refs] = await Promise.all([
      getDiscourseContextResults({
        uid: getPageUidByPageTitle(tag),
        nodes,
        relations,
        ignoreCache,
      }),
      window.roamAlphaAPI.data.backend.q(
        `[:find ?a :where [?b :node/title "${normalizePageTitle(tag)}"] [?a :block/refs ?b]]`,
      ),
    ]);

    return (cache[tag] = {
      results,
      refs: refs.length,
    });
  } catch (error) {
    console.error(`Error getting overlay info for ${tag}:`, error);
    return {
      results: [],
      refs: 0,
    };
  }
};

const OPACITY_VALUES = [
  "5",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
  "55",
  "60",
  "65",
  "70",
  "75",
  "80",
  "85",
  "90",
  "95",
  "100",
] as const;

type OpacityValue = (typeof OPACITY_VALUES)[number];

type DiscourseContextOverlayBaseProps = {
  id: string;
  iconColor?: string;
  textColor?: string;
  opacity?: OpacityValue;
};

// need tag or uid
type DiscourseContextOverlayProps = DiscourseContextOverlayBaseProps &
  ({ tag: string; uid?: never } | { tag?: never; uid: string });

export const ICON_SIZE = 10;

export const DiscourseContextButton = ({
  id,
  iconColor,
  textColor,
  loading,
  score,
  refs,
  onClick,
  opacity = "100",
}: DiscourseContextOverlayBaseProps & {
  loading: boolean;
  score: string | number;
  refs: number;
  onClick?: (event: React.MouseEvent) => void;
}) => {
  return (
    <Button
      small
      id={id}
      className={`roamjs-discourse-context-overlay ${
        loading ? "animate-pulse" : ""
      }`}
      style={{
        minHeight: "initial",
        paddingTop: ".25rem",
        paddingBottom: ".25rem",
      }}
      minimal
      disabled={loading}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          icon={"diagram-tree"}
          color={iconColor}
          style={{ opacity: `${Number(opacity) / 100}` }}
          size={ICON_SIZE}
        />
        <span
          className={`mr-1 text-xs leading-none opacity-${opacity}`}
          style={{ color: textColor }}
        >
          {loading ? "-" : score}
        </span>
        <Icon
          icon={"link"}
          color={iconColor}
          style={{ opacity: `${Number(opacity) / 100}` }}
          size={ICON_SIZE}
        />
        <span
          className={`text-xs leading-none opacity-${opacity}`}
          style={{ color: textColor }}
        >
          {loading ? "-" : refs}
        </span>
      </div>
    </Button>
  );
};

const DiscourseContextPopupOverlay = ({
  tag,
  id,
  uid,
  iconColor,
  textColor,
  opacity = "100",
}: DiscourseContextOverlayProps) => {
  const tagUid = useMemo(() => uid ?? getPageUidByPageTitle(tag), [uid, tag]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<DiscourseData["results"]>([]);
  const [refs, setRefs] = useState(0);
  const [score, setScore] = useState<number | string>(0);
  const getInfo = useCallback(
    (ignoreCache?: boolean) =>
      getOverlayInfo(
        tag ?? (uid ? (getPageTitleByPageUid(uid) ?? "") : ""),
        ignoreCache,
      )
        .then(({ refs, results }) => {
          const discourseNode = findDiscourseNode({ uid: tagUid });
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
    [tag, uid, tagUid, setResults, setLoading, setRefs, setScore],
  );
  const refresh = useCallback(() => {
    setLoading(true);
    void getInfo(true);
  }, [getInfo, setLoading]);
  useEffect(() => {
    void getInfo();
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
          <ContextContent
            uid={tagUid}
            results={results}
            overlayRefresh={refresh}
          />
        </div>
      }
      target={
        <DiscourseContextButton
          id={id}
          iconColor={iconColor}
          textColor={textColor}
          loading={loading}
          score={score}
          refs={refs}
          opacity={opacity}
        ></DiscourseContextButton>
      }
      position={Position.BOTTOM}
    />
  );
};

export const DiscourseContextCollapseOverlay = ({
  tag,
  id,
  uid,
  iconColor,
  textColor,
  opacity = "100",
}: DiscourseContextOverlayProps) => {
  const tagUid = useMemo(() => uid ?? getPageUidByPageTitle(tag), [uid, tag]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<DiscourseData["results"]>([]);
  const [refs, setRefs] = useState(0);
  const [score, setScore] = useState<number | string>(0);
  const getInfo = useCallback(
    (ignoreCache?: boolean) =>
      getOverlayInfo(
        tag ?? (uid ? (getPageTitleByPageUid(uid) ?? "") : ""),
        ignoreCache,
      )
        .then(({ refs, results }) => {
          const discourseNode = findDiscourseNode({ uid: tagUid });
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
    [tag, uid, tagUid, setResults, setLoading, setRefs, setScore],
  );
  const refresh = useCallback(() => {
    setLoading(true);
    void getInfo(true);
  }, [getInfo, setLoading]);
  useEffect(() => {
    void getInfo();
  }, [refresh, getInfo]);
  return (
    <>
      <DiscourseContextButton
        id={id}
        iconColor={iconColor}
        textColor={textColor}
        loading={loading}
        score={score}
        refs={refs}
        opacity={opacity}
        onClick={() => {
          setOpen(!open);
        }}
      />
      <Collapse
        isOpen={open}
        keepChildrenMounted={true}
        className="discourse-context-collapse-el"
      >
        <Card className={"my-3" + (loading ? " bp3-skeleton" : "")}>
          <ContextContent
            uid={tagUid}
            results={results}
            overlayRefresh={refresh}
          />
        </Card>
      </Collapse>
    </>
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
    <DiscourseContextPopupOverlay tag={tag} id={id} />
  ) : (
    <Button
      small
      id={id}
      className={`roamjs-discourse-context-overlay`}
      style={{
        minHeight: "initial",
        paddingTop: ".25rem",
        paddingBottom: ".25rem",
      }}
      minimal
      disabled={true}
    >
      <div className="flex items-center gap-1.5">
        <Icon icon={"diagram-tree"} size={ICON_SIZE} />
        <span className={`mr-1 text-xs leading-none`}>-</span>
        <Icon icon={"link"} size={ICON_SIZE} />
        <span className={`text-xs leading-none`}>-</span>
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

export default DiscourseContextPopupOverlay;
