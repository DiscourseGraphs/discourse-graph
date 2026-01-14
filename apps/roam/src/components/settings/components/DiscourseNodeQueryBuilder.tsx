import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Button, Card, Spinner } from "@blueprintjs/core";
import fireQuery from "~/utils/fireQuery";
import { DEFAULT_RETURN_NODE } from "~/utils/parseQuery";
import type { Condition, Result, Column } from "~/utils/types";
import {
  getDiscourseNodeSetting,
  setDiscourseNodeSetting,
} from "../utils/accessors";
import DiscourseNodeQueryEditor from "./DiscourseNodeQueryEditor";
import ResultsView from "~/components/results-view/ResultsView";

const generateUID = (): string =>
  window.roamAlphaAPI?.util?.generateUID?.() ??
  Math.random().toString(36).substring(2, 11);

type Props = {
  nodeType: string;
  nodeText: string;
};

const DiscourseNodeQueryBuilder = ({ nodeType, nodeText }: Props) => {
  const defaultCondition = useMemo<Condition>(
    () => ({
      uid: generateUID(),
      type: "clause",
      source: DEFAULT_RETURN_NODE,
      relation: "is a",
      target: nodeText,
    }),
    [nodeText],
  );

  const [isEdit, setIsEdit] = useState(() => {
    const indexData = getDiscourseNodeSetting<{
      conditions: Condition[];
    }>(nodeType, ["index"]);
    return !indexData?.conditions?.length;
  });

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [columns, setColumns] = useState<Column[]>([
    { key: "text", uid: "", selection: DEFAULT_RETURN_NODE },
  ]);

  const getConditions = useCallback((): Condition[] => {
    const indexData = getDiscourseNodeSetting<{
      conditions: Condition[];
    }>(nodeType, ["index"]);
    return indexData?.conditions?.length
      ? indexData.conditions
      : [defaultCondition];
  }, [nodeType, defaultCondition]);

  const onRefresh = useCallback(() => {
    setLoading(true);
    const conditions = getConditions();

    fireQuery({
      conditions,
      selections: [],
      returnNode: DEFAULT_RETURN_NODE,
    })
      .then((queryResults) => {
        setResults(queryResults);
        setColumns([{ key: "text", uid: "", selection: DEFAULT_RETURN_NODE }]);
      })
      .catch((err) => {
        console.error("Query failed:", err);
        setResults([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [getConditions]);

  const handleQuery = useCallback(() => {
    const conditions = getConditions();
    if (!conditions.length) {
      setDiscourseNodeSetting(nodeType, ["index", "conditions"], [
        defaultCondition,
      ]);
    }
    setIsEdit(false);
    onRefresh();
  }, [getConditions, nodeType, defaultCondition, onRefresh]);

  useEffect(() => {
    if (!isEdit) {
      onRefresh();
    }
  }, []);

  return (
    <Card className="roamjs-discourse-node-query-builder overflow-auto p-0">
      {isEdit && (
        <div className="p-4">
          <DiscourseNodeQueryEditor
            nodeType={nodeType}
            settingKeys={["index", "conditions"]}
            defaultConditions={[defaultCondition]}
          />
          <div className="mt-4 flex gap-2">
            <Button intent="primary" onClick={handleQuery} text="Query" />
          </div>
        </div>
      )}
      {loading ? (
        <div className="px-8 py-4">
          <Spinner size={20} /> Loading Results...
        </div>
      ) : !isEdit ? (
        <ResultsView
          parentUid={nodeType}
          columns={columns}
          results={results}
          onRefresh={onRefresh}
          onEdit={() => setIsEdit(true)}
          preventSavingSettings={true}
        />
      ) : null}
    </Card>
  );
};

export default DiscourseNodeQueryBuilder;
