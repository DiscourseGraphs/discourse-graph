import {
  Button,
  Icon,
  Portal,
  Switch,
  Tabs,
  Tab,
  Tooltip,
  Spinner,
} from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { Result } from "roamjs-components/types/query-builder";
import nanoId from "nanoid";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import ResultsView from "./results-view/ResultsView";
import posthog from "posthog-js";
import { CreateRelationButton } from "./CreateRelationDialog";

export type DiscourseContextResults = Awaited<
  ReturnType<typeof getDiscourseContextResults>
>;

type Props = {
  uid: string;
  results?: DiscourseContextResults;
};

const ExtraColumnRow = (r: Result) => {
  const [contextOpen, setContextOpen] = useState(false);
  const [contextRowReady, setContextRowReady] = useState(false);
  const contextId = useMemo(() => `td-${nanoId()}`, []);
  const anchorId = useMemo(() => `td-${nanoId()}`, []);
  const [anchorOpen, setAnchorOpen] = useState(false);
  const [anchorRowReady, setAnchorRowReady] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const contextPageTitle = useMemo(
    () =>
      r["context-uid"] && getPageTitleByPageUid(r["context-uid"].toString()),
    [r["context-uid"]],
  );
  const contextBreadCrumbs = useMemo(
    () =>
      r["context-uid"]
        ? window.roamAlphaAPI
            .q(
              `[:find (pull ?p [:node/title :block/string :block/uid]) :where
              [?b :block/uid "${r["context-uid"]}"]
              [?b :block/parents ?p]
            ]`,
            )
            .map(
              (a) => a[0] as { string?: string; title?: string; uid: string },
            )
            .map((a) => ({ uid: a.uid, text: a.string || a.title || "" }))
        : [],
    [r["context-uid"]],
  );
  const contextChildren = useMemo(
    () =>
      r["context-uid"] && contextPageTitle
        ? getShallowTreeByParentUid(r["context-uid"].toString()).map(
            ({ uid }) => uid,
          )
        : [r["context-uid"].toString()],
    [r["context-uid"], contextPageTitle, r.uid],
  );
  useEffect(() => {
    if (contextOpen && containerRef.current) {
      const row = containerRef.current.closest("tr");
      const contextElement = document.createElement("tr");
      const contextTd = document.createElement("td");
      contextTd.colSpan = row?.childElementCount || 0;
      contextElement.id = contextId;
      row?.parentElement?.insertBefore(contextElement, row.nextElementSibling);
      contextElement.append(contextTd);
      setContextRowReady(true);
    } else {
      setContextRowReady(false);
      document.getElementById(contextId)?.remove();
    }
  }, [contextOpen, setContextRowReady, contextId]);
  useEffect(() => {
    if (contextRowReady) {
      setTimeout(() => {
        contextChildren.forEach((uid) => {
          const el = document.querySelector<HTMLElement>(
            `tr#${contextId} div[data-uid="${uid}"]`,
          );
          if (el)
            window.roamAlphaAPI.ui.components.renderBlock({
              uid,
              el,
            });
        });
      }, 1);
    }
  }, [contextRowReady]);
  useEffect(() => {
    if (anchorOpen) {
      const row = containerRef.current?.closest("tr");
      const anchorElement = document.createElement("tr");
      const anchorTd = document.createElement("td");
      anchorTd.colSpan = row?.childElementCount || 0;
      anchorElement.id = anchorId;
      row?.parentElement?.insertBefore(anchorElement, row.nextElementSibling);
      anchorElement.append(anchorTd);
      setAnchorRowReady(true);
    } else {
      setAnchorRowReady(false);
      document.getElementById(anchorId)?.remove();
    }
  }, [anchorOpen, setAnchorRowReady, anchorId]);
  return (
    <span ref={containerRef}>
      {r["context-uid"] && (
        <Tooltip content={"Context"}>
          <Button
            onClick={() => setContextOpen(!contextOpen)}
            small
            active={contextOpen}
            style={{
              opacity: 0.5,
              fontSize: "0.8em",
              ...(contextOpen
                ? {
                    opacity: 1,
                    color: "#8A9BA8",
                    backgroundColor: "#F5F8FA",
                  }
                : {}),
            }}
            minimal
            icon="info-sign"
          />
        </Tooltip>
      )}
      <style>
        {`#${contextId} td,
#${anchorId} td {
  position: relative;
  background-color: #F5F8FA;
  padding: 16px;
  max-height: 240px;
  overflow-y: scroll;
}
#${contextId} .bp3-portal,
#${anchorId} .bp3-portal {
  position: relative;
}`}
      </style>
      {contextRowReady && (
        <Portal
          container={
            document.getElementById(contextId)
              ?.firstElementChild as HTMLDataElement
          }
          className={"relative"}
        >
          {contextPageTitle ? (
            <h3 style={{ margin: 0 }}>{contextPageTitle}</h3>
          ) : (
            <div className="rm-zoom">
              {contextBreadCrumbs.map((bc) => (
                <div key={bc.uid} className="rm-zoom-item">
                  <span className="rm-zoom-item-content">{bc.text}</span>
                  <Icon icon={"chevron-right"} />
                </div>
              ))}
            </div>
          )}
          {contextChildren.map((uid) => (
            <div data-uid={uid} key={uid}></div>
          ))}
        </Portal>
      )}
      {r.anchor && (
        <Tooltip content={"See Related Relations"}>
          <Button
            onClick={() => setAnchorOpen(!anchorOpen)}
            active={anchorOpen}
            small
            style={{
              opacity: 0.5,
              fontSize: "0.8em",
              ...(anchorOpen
                ? {
                    opacity: 1,
                    color: "#8A9BA8",
                    backgroundColor: "#F5F8FA",
                  }
                : {}),
            }}
            minimal
            icon={"resolve"}
          />
        </Tooltip>
      )}
      {anchorRowReady && (
        <Portal
          container={
            document.getElementById(anchorId)
              ?.firstElementChild as HTMLDataElement
          }
        >
          <ContextContent uid={r["anchor-uid"]} results={[]} />
        </Portal>
      )}
    </span>
  );
};

const ContextTab = ({
  parentUid,
  r,
  groupByTarget,
  setGroupByTarget,
  onRefresh,
}: {
  parentUid: string;
  r: DiscourseContextResults[number];
  groupByTarget: boolean;
  setGroupByTarget: (b: boolean) => void;
  onRefresh: (ignoreCache?: boolean) => void;
}) => {
  const [subTabId, setSubTabId] = useState(0);

  const subTabs = useMemo(
    () =>
      groupByTarget
        ? Array.from(
            new Set(Object.values(r.results).map((res) => res.target)),
          ).sort()
        : [],
    [groupByTarget, r.results],
  );
  const getFilteredResults = useCallback(
    (id: number) =>
      Object.entries(r.results).filter(([, res]) => res.target === subTabs[id]),
    [subTabs, r.results],
  );
  const results = useMemo(
    () =>
      groupByTarget
        ? Object.fromEntries(getFilteredResults(subTabId))
        : r.results,
    [groupByTarget, r.results, subTabId, getFilteredResults],
  );
  const columns = useMemo(
    () => [
      {
        key: "text",
        // we currently don't care about the uid since we don't save settings yet for this ResultsView
        uid: "uid",
        selection: "text",
      },
    ],
    [],
  );
  const resultsView = (
    <ResultsView
      // TODO - always save settings, but maybe separate from root `parentUid`?
      preventSavingSettings
      parentUid={parentUid}
      results={Object.values(results).map(({ target, ...a }) => a as Result)}
      columns={columns}
      onRefresh={onRefresh}
      header={
        <h4 className="m-0 mb-2 flex items-center justify-between">
          <span>{r.label}</span>
          <span style={{ display: "flex", alignItems: "center" }}>
            <CreateRelationButton
              sourceNodeUid={parentUid}
              onClose={() => {
                window.setTimeout(onRefresh, 250);
              }}
            />
            <Switch
              label="Group By Target"
              checked={groupByTarget}
              style={{ fontSize: 8, marginLeft: 4, marginBottom: 0 }}
              onChange={(e) =>
                setGroupByTarget((e.target as HTMLInputElement).checked)
              }
            />
          </span>
        </h4>
      }
    />
  );
  return subTabs.length ? (
    <Tabs
      selectedTabId={subTabId}
      onChange={(e) => setSubTabId(Number(e))}
      vertical
    >
      {subTabs.map((target, j) => (
        <Tab
          key={j}
          id={j}
          title={`(${getFilteredResults(j).length}) ${target}`}
          panelClassName="roamjs-discourse-result-panel"
          panel={resultsView}
        />
      ))}
    </Tabs>
  ) : (
    resultsView
  );
};

export const ContextContent = ({ uid, results }: Props) => {
  const [rawQueryResults, setRawQueryResults] = useState<
    Record<string, DiscourseContextResults[number]>
  >({});
  const queryResults = useMemo(
    () =>
      Object.values(rawQueryResults).filter(
        (r) => !!Object.keys(r.results).length,
      ),
    [rawQueryResults],
  );
  const [loading, setLoading] = useState(true);
  const debouncedLoading = useDebounce(loading, 150);

  const addLabels = useCallback((result: DiscourseContextResults[number]) => {
    setRawQueryResults((prev) => ({
      ...prev,
      [result.label]: {
        label: result.label,
        results: {
          ...(prev[result.label]?.results || {}),
          ...result.results,
        },
      },
    }));
  }, []);

  const onRefresh = useCallback(
    (ignoreCache = true) => {
      setRawQueryResults({});
      void getDiscourseContextResults({
        uid,
        onResult: addLabels,
        ignoreCache,
      }).finally(() => setLoading(false));
    },
    [uid, setRawQueryResults, setLoading, addLabels],
  );

  const delayedRefresh = () => {
    window.setTimeout(onRefresh, 250);
  };

  useEffect(() => {
    if (!results) {
      onRefresh(false);
    } else {
      results.forEach(addLabels);
      setLoading(false);
    }
  }, [onRefresh, results, setLoading, loading, addLabels]);
  const [tabId, setTabId] = useState(0);
  const [groupByTarget, setGroupByTarget] = useState(false);
  return queryResults.length ? (
    <>
      <style>{`.roamjs-discourse-result-panel .roamjs-query-results-header {
  padding-top: 0;
}

.roamjs-discourse-result-panel .roamjs-query-results-metadata {
  display: none;
}`}</style>
      <Tabs
        selectedTabId={tabId}
        onChange={(e) => setTabId(Number(e))}
        vertical
        renderActiveTabPanelOnly
      >
        {queryResults.map((r, i) => (
          <Tab
            id={i}
            key={i}
            title={`(${Object.values(r.results).length}) ${r.label}`}
            panelClassName="roamjs-discourse-result-panel"
            panel={
              <ContextTab
                key={i}
                parentUid={uid}
                r={r}
                groupByTarget={groupByTarget}
                setGroupByTarget={setGroupByTarget}
                onRefresh={onRefresh}
              />
            }
          />
        ))}
        {debouncedLoading && (
          <div className="text-muted-foreground m-auto flex items-center gap-2 text-sm">
            <Spinner />
          </div>
        )}
      </Tabs>
    </>
  ) : debouncedLoading && !results ? (
    <Tabs selectedTabId={0} onChange={() => {}} vertical>
      <Tab
        id={0}
        title="Loading ..."
        disabled
        panel={
          <div>
            <div className="bp3-skeleton h-36" />
          </div>
        }
      />
    </Tabs>
  ) : (
    <div className="text-center">
      No discourse relations found.
      <CreateRelationButton sourceNodeUid={uid} onClose={delayedRefresh} />
    </div>
  );
};

const DiscourseContext = ({ uid }: Props) => {
  const [caretShown, setCaretShown] = useState(false);
  const [caretOpen, setCaretOpen] = useState(false);
  return (
    <>
      <div
        className={"flex-h-box"}
        onMouseEnter={() => setCaretShown(true)}
        onMouseLeave={() => setCaretShown(false)}
        style={{ marginBottom: 4 }}
      >
        <span
          className={`bp3-icon-standard bp3-icon-caret-down rm-caret ${
            caretOpen ? "rm-caret-open" : "rm-caret-closed"
          } ${
            caretShown ? "rm-caret-showing" : "rm-caret-hidden"
          } dont-focus-block`}
          onClick={() => {
            setCaretOpen(!caretOpen);
            if (!caretOpen) {
              posthog.capture("Discourse Context: Show Results", {
                uid: uid,
              });
            }
          }}
        />
        <div style={{ flex: "0 1 2px" }} />
        <div style={{ color: "rgb(206, 217, 224)" }}>
          <strong>Discourse Context</strong>
        </div>
      </div>
      <div style={{ paddingLeft: 16 }}>
        {caretOpen && <ContextContent uid={uid} />}
      </div>
    </>
  );
};

// used here to prevent the loading spinner from flashing briefly when queries resolve quickly
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default DiscourseContext;
