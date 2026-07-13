import { Switch, Tabs, Tab, Spinner } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Result } from "roamjs-components/types/query-builder";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import ResultsView from "./results-view/ResultsView";
import posthog from "posthog-js";
import { CreateRelationButton } from "./CreateRelationDialog";
import {
  DISCOURSE_CONTEXT_MUTATION_REFRESH_EVENT,
  type DiscourseContextMutationRefreshDetail,
} from "~/utils/discourseContextMutationRefresh";

export type DiscourseContextResults = Awaited<
  ReturnType<typeof getDiscourseContextResults>
>;

type Props = {
  uid: string;
  results?: DiscourseContextResults;
  overlayRefresh?: (ignoreCache?: boolean) => void;
};

const removeTargetFromResult = (
  result: Partial<Result & { target: string }>,
): Result => {
  const tableResult = { ...result };
  delete tableResult.target;
  return tableResult as Result;
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
      results={Object.values(results).map(removeTargetFromResult)}
      columns={columns}
      onRefresh={onRefresh}
      header={
        <h4 className="m-0 mb-2 flex items-center justify-between">
          <span>{r.label}</span>
          <span style={{ display: "flex", alignItems: "center" }}>
            <CreateRelationButton
              sourceNodeUid={parentUid}
              onClose={(created) => {
                if (!created) return;
                window.setTimeout(onRefresh, 150, true);
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

export const ContextContent = ({ uid, results, overlayRefresh }: Props) => {
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
      }).finally(() => {
        if (overlayRefresh) overlayRefresh(ignoreCache);
        setLoading(false);
      });
    },
    [uid, setRawQueryResults, setLoading, addLabels, overlayRefresh],
  );

  const delayedRefresh = () => {
    window.setTimeout(onRefresh, 150, true);
  };

  useEffect(() => {
    if (!results) {
      onRefresh(false);
    } else {
      results.forEach(addLabels);
      setLoading(false);
    }
  }, [onRefresh, results, setLoading, loading, addLabels]);

  useEffect(() => {
    const onMutationRefresh = (event: Event) => {
      const detail = (
        event as CustomEvent<DiscourseContextMutationRefreshDetail>
      ).detail;
      if (!detail?.uids.includes(uid)) return;
      onRefresh(true);
    };

    document.body.addEventListener(
      DISCOURSE_CONTEXT_MUTATION_REFRESH_EVENT,
      onMutationRefresh,
    );
    return () => {
      document.body.removeEventListener(
        DISCOURSE_CONTEXT_MUTATION_REFRESH_EVENT,
        onMutationRefresh,
      );
    };
  }, [uid, onRefresh]);
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
      <CreateRelationButton
        sourceNodeUid={uid}
        onClose={(created) => {
          if (!created) return;
          delayedRefresh();
        }}
      />
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
          <strong>Discourse context</strong>
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
