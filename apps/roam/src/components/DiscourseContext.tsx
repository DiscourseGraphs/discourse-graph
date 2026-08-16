import { Switch, Tabs, Tab, Spinner } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Result } from "roamjs-components/types/query-builder";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import ResultsView from "./results-view/ResultsView";
import posthog from "posthog-js";
import { CreateRelationButton } from "./CreateRelationDialog";
import { useDiscourseContextMutationRefresh } from "~/utils/discourseContextMutationRefresh";

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
  onRefresh,
}: {
  parentUid: string;
  r: DiscourseContextResults[number];
  groupByTarget: boolean;
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
      simplified
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
    (
      ignoreCache = true,
      { skipOverlayRefresh = false }: { skipOverlayRefresh?: boolean } = {},
    ) => {
      setRawQueryResults({});
      void getDiscourseContextResults({
        uid,
        onResult: addLabels,
        ignoreCache,
      }).finally(() => {
        if (overlayRefresh && !skipOverlayRefresh) overlayRefresh(ignoreCache);
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

  // Any enclosing overlay subscribes to the same event, so let it refresh itself
  // rather than triggering a second overlay query from here.
  const refreshForMutation = useCallback(
    () => onRefresh(true, { skipOverlayRefresh: true }),
    [onRefresh],
  );
  useDiscourseContextMutationRefresh({
    uid,
    onMutationRefresh: refreshForMutation,
  });
  const [tabId, setTabId] = useState(0);
  const [groupByTarget, setGroupByTarget] = useState(false);
  return queryResults.length ? (
    <>
      <style>{`.roamjs-discourse-result-panel .roamjs-query-results-delete-relation {
  visibility: hidden;
}

.roamjs-discourse-result-panel tr:hover .roamjs-query-results-delete-relation,
.roamjs-discourse-result-panel tr:focus-within .roamjs-query-results-delete-relation {
  visibility: visible;
}

.roamjs-discourse-context-tabs > .bp3-tab-list {
  align-self: stretch;
}`}</style>
      <Tabs
        className="roamjs-discourse-context-tabs"
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
        <div className="roamjs-discourse-context-controls mt-auto box-border flex w-full flex-none flex-col px-2 pt-2">
          <Switch
            label="Group By Target"
            checked={groupByTarget}
            className="mb-1"
            style={{ fontSize: 8 }}
            onChange={(e) =>
              setGroupByTarget((e.target as HTMLInputElement).checked)
            }
          />
          <CreateRelationButton
            sourceNodeUid={uid}
            onCreated={delayedRefresh}
            fill
          />
        </div>
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
    <div className="flex flex-col items-start">
      <span>No discourse relations found.</span>
      <CreateRelationButton sourceNodeUid={uid} onCreated={delayedRefresh} />
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
