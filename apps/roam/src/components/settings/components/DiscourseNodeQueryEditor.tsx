import React, { useState, useCallback, useMemo, useRef } from "react";
import { Button, H6, InputGroup, Tabs, Tab } from "@blueprintjs/core";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import {
  getConditionLabels,
  isTargetVariable,
  sourceToTargetOptions,
  sourceToTargetPlaceholder,
} from "~/utils/conditionToDatalog";
import type {
  Condition,
  QBClause,
  QBNot,
  QBOr,
  QBNor,
  QBClauseData,
  QBNestedData,
} from "~/utils/types";
import {
  getDiscourseNodeSetting,
  setDiscourseNodeSetting,
} from "../utils/accessors";

const DEFAULT_RETURN_NODE = "node";

const generateUID = (): string =>
  window.roamAlphaAPI?.util?.generateUID?.() ??
  Math.random().toString(36).substring(2, 11);

const getSourceCandidates = (cs: Condition[]): string[] =>
  cs.flatMap((c) =>
    c.type === "clause" || c.type === "not"
      ? isTargetVariable({ relation: c.relation })
        ? [c.target]
        : []
      : getSourceCandidates(c.conditions.flat()),
  );

type QueryClauseProps = {
  con: QBClause | QBNot;
  index: number;
  setConditions: React.Dispatch<React.SetStateAction<Condition[]>>;
  getAvailableVariables: (index: number) => string[];
  onSave: () => void;
};

const QueryClause = ({
  con,
  index,
  setConditions,
  getAvailableVariables,
  onSave,
}: QueryClauseProps) => {
  const debounceRef = useRef(0);
  const conditionLabels = useMemo(getConditionLabels, []);
  const targetOptions = useMemo(
    () => sourceToTargetOptions({ source: con.source, relation: con.relation }),
    [con.source, con.relation],
  );
  const targetPlaceholder = useMemo(
    () => sourceToTargetPlaceholder({ relation: con.relation }),
    [con.relation],
  );

  const setConditionRelation = useCallback(
    (e: string, timeout: boolean = true) => {
      window.clearTimeout(debounceRef.current);
      setConditions((conditions) =>
        conditions.map((c) => (c.uid === con.uid ? { ...c, relation: e } : c)),
      );
      debounceRef.current = window.setTimeout(
        () => onSave(),
        timeout ? 1000 : 0,
      );
    },
    [setConditions, con.uid, onSave],
  );

  const setConditionTarget = useCallback(
    (e: string, timeout: boolean = true) => {
      window.clearTimeout(debounceRef.current);
      setConditions((conditions) =>
        conditions.map((c) => (c.uid === con.uid ? { ...c, target: e } : c)),
      );
      debounceRef.current = window.setTimeout(
        () => onSave(),
        timeout ? 1000 : 0,
      );
    },
    [setConditions, con.uid, onSave],
  );

  const availableSources = useMemo(
    () => getAvailableVariables(index),
    [getAvailableVariables, index],
  );

  return (
    <>
      <MenuItemSelect
        popoverProps={{
          className: "roamjs-query-condition-source",
        }}
        ButtonProps={{
          id: `${con.uid}-source`,
        }}
        activeItem={con.source}
        items={availableSources}
        onItemSelect={(value) => {
          setConditions((conditions) =>
            conditions.map((c) =>
              c.uid === con.uid ? { ...con, source: value } : c,
            ),
          );
          onSave();
        }}
      />
      <div className="roamjs-query-condition-relation">
        <AutocompleteInput
          value={con.relation}
          setValue={setConditionRelation}
          onBlur={(e) => setConditionRelation(e, false)}
          options={conditionLabels}
          placeholder={"Choose relationship"}
          id={`${con.uid}-relation`}
        />
      </div>
      <div className="roamjs-query-condition-target">
        <AutocompleteInput
          value={con.target}
          setValue={setConditionTarget}
          onBlur={(e) => setConditionTarget(e, false)}
          options={targetOptions}
          placeholder={targetPlaceholder}
          id={`${con.uid}-target`}
        />
      </div>
    </>
  );
};

type QueryNestedDataProps = {
  con: QBOr | QBNor;
  setView: (s: { uid: string; branch: number }) => void;
};

const QueryNestedData = ({ con, setView }: QueryNestedDataProps) => {
  return (
    <>
      <span style={{ minWidth: 144, display: "inline-block" }}>
        <Button
          rightIcon={"arrow-right"}
          text={"Edit"}
          onClick={() => setView({ uid: con.uid, branch: 0 })}
          style={{ maxHeight: 32 }}
        />
      </span>
      <span
        style={{
          minWidth: 144,
          display: "inline-block",
          fontWeight: 600,
        }}
      >
        ({con.conditions.length}) BRANCHES
      </span>
      <span
        style={{
          flexGrow: 1,
          minWidth: 260,
          width: "100%",
          display: "inline-block",
        }}
      ></span>
    </>
  );
};

type QueryConditionProps = {
  con: Condition;
  index: number;
  setConditions: React.Dispatch<React.SetStateAction<Condition[]>>;
  getAvailableVariables: (n: number) => string[];
  setView: (s: { uid: string; branch: number }) => void;
  onSave: () => void;
  onDelete: (uid: string) => void;
};

const QueryCondition = ({
  con,
  index,
  setConditions,
  getAvailableVariables,
  setView,
  onSave,
  onDelete,
}: QueryConditionProps) => {
  return (
    <div style={{ display: "flex", margin: "8px 0", alignItems: "baseline" }}>
      <MenuItemSelect
        popoverProps={{
          className: "roamjs-query-condition-type",
        }}
        activeItem={con.type}
        items={["clause", "not", "or", "not or"]}
        onItemSelect={(value) => {
          const isChangingStructure =
            ((con.type === "or" || con.type === "not or") &&
              (value === "clause" || value === "not")) ||
            ((value === "or" || value === "not or") &&
              (con.type === "clause" || con.type === "not"));

          setConditions((conditions) =>
            conditions.map((c) => {
              if (c.uid !== con.uid) return c;

              if (value === "clause" || value === "not") {
                return {
                  uid: c.uid,
                  type: value,
                  source: (c as QBClauseData).source || DEFAULT_RETURN_NODE,
                  target: (c as QBClauseData).target || "",
                  relation: (c as QBClauseData).relation || "",
                };
              } else {
                return {
                  uid: c.uid,
                  type: value,
                  conditions: isChangingStructure
                    ? []
                    : (c as QBNestedData).conditions || [],
                };
              }
            }),
          );
          onSave();
        }}
      />
      {(con.type === "clause" || con.type === "not") && (
        <QueryClause
          con={con}
          index={index}
          setConditions={setConditions}
          getAvailableVariables={getAvailableVariables}
          onSave={onSave}
        />
      )}
      {(con.type === "not or" || con.type === "or") && (
        <QueryNestedData con={con} setView={setView} />
      )}
      <Button
        icon={"trash"}
        onClick={() => onDelete(con.uid)}
        minimal
        style={{ alignSelf: "end", minWidth: 30 }}
      />
    </div>
  );
};

const getConditionByUid = (
  uid: string,
  conditions: Condition[],
): Condition | undefined => {
  for (const con of conditions) {
    if (con.uid === uid) return con;
    if (con.type === "or" || con.type === "not or") {
      const c = getConditionByUid(uid, con.conditions.flat());
      if (c) return c;
    }
  }
  return undefined;
};

type DiscourseNodeQueryEditorProps = {
  nodeType: string;
  defaultConditions?: Condition[];
  settingKeys?: string[];
};

const DiscourseNodeQueryEditor = ({
  nodeType,
  defaultConditions = [],
  settingKeys = ["specification"],
}: DiscourseNodeQueryEditorProps) => {
  const [conditions, _setConditions] = useState<Condition[]>(() => {
    const stored = getDiscourseNodeSetting<Condition[]>(nodeType, settingKeys);
    return stored && stored.length > 0 ? stored : defaultConditions;
  });

  const saveConditions = useCallback(
    (newConditions: Condition[]) => {
      setDiscourseNodeSetting(nodeType, settingKeys, newConditions);
    },
    [nodeType, settingKeys],
  );

  const setConditions: React.Dispatch<React.SetStateAction<Condition[]>> =
    useCallback(
      (action) => {
        _setConditions((prev) => {
          const next = typeof action === "function" ? action(prev) : action;
          return next;
        });
      },
      [_setConditions],
    );

  const handleSave = useCallback(() => {
    _setConditions((current) => {
      saveConditions(current);
      return current;
    });
  }, [saveConditions]);

  const [viewStack, setViewStack] = useState([{ uid: nodeType, branch: 0 }]);
  const view = useMemo(() => viewStack.slice(-1)[0], [viewStack]);
  const viewCondition = useMemo(
    () =>
      view.uid === nodeType
        ? undefined
        : (getConditionByUid(view.uid, conditions) as QBOr | QBNor | undefined),
    [view, conditions, nodeType],
  );

  const nestedSetConditions = useMemo<
    React.Dispatch<React.SetStateAction<Condition[]>>
  >(() => {
    if (view.uid === nodeType) return setConditions;
    return (nestedConditions) => {
      if (!viewCondition) return;
      setConditions((cons) => {
        const updateNested = (conditions: Condition[]): Condition[] =>
          conditions.map((c): Condition => {
            if (c.uid === viewCondition.uid && (c.type === "or" || c.type === "not or")) {
              const newConditions = [...c.conditions];
              if (typeof nestedConditions === "function") {
                newConditions[view.branch] = nestedConditions(
                  newConditions[view.branch] || [],
                );
              } else {
                newConditions[view.branch] = nestedConditions;
              }
              return { ...c, conditions: newConditions };
            }
            if (c.type === "or" || c.type === "not or") {
              return {
                ...c,
                conditions: c.conditions.map((branch) => updateNested(branch)),
              };
            }
            return c;
          });
        return updateNested(cons);
      });
    };
  }, [setConditions, view.uid, nodeType, viewCondition, view.branch]);

  const viewConditions = useMemo(
    () =>
      view.uid === nodeType
        ? conditions
        : viewCondition?.conditions?.[view.branch] || [],
    [view, viewCondition, conditions, nodeType],
  );

  const getAvailableVariables = useCallback(
    (index: number) =>
      Array.from(
        new Set(getSourceCandidates(viewConditions.slice(0, index))),
      ).concat(DEFAULT_RETURN_NODE),
    [viewConditions],
  );

  const addCondition = useCallback(() => {
    const newCondition: QBClause = {
      uid: generateUID(),
      source: DEFAULT_RETURN_NODE,
      relation: "",
      target: "",
      type: "clause",
    };
    nestedSetConditions((cons) => [...cons, newCondition]);
    setTimeout(() => {
      handleSave();
      document.getElementById(`${newCondition.uid}-relation`)?.focus();
    }, 0);
  }, [nestedSetConditions, handleSave]);

  const deleteCondition = useCallback(
    (uid: string) => {
      nestedSetConditions((cons) => cons.filter((c) => c.uid !== uid));
      setTimeout(() => handleSave(), 0);
    },
    [nestedSetConditions, handleSave],
  );

  const createBranch = useCallback(() => {
    if (!viewCondition) return;
    const newBranch = viewCondition.conditions.length;
    setConditions((cons) => {
      const updateNested = (conditions: Condition[]): Condition[] =>
        conditions.map((c): Condition => {
          if (c.uid === viewCondition.uid && (c.type === "or" || c.type === "not or")) {
            return { ...c, conditions: [...c.conditions, []] };
          }
          if (c.type === "or" || c.type === "not or") {
            return {
              ...c,
              conditions: c.conditions.map((branch) => updateNested(branch)),
            };
          }
          return c;
        });
      return updateNested(cons);
    });
    setViewStack((vs) =>
      vs.slice(0, -1).concat({ uid: view.uid, branch: newBranch }),
    );
    setTimeout(() => handleSave(), 0);
  }, [view.uid, viewCondition, setConditions, handleSave]);

  const deleteBranch = useCallback(() => {
    if (!viewCondition || viewCondition.conditions.length <= 1) return;
    setConditions((cons) => {
      const updateNested = (conditions: Condition[]): Condition[] =>
        conditions.map((c): Condition => {
          if (c.uid === viewCondition.uid && (c.type === "or" || c.type === "not or")) {
            return {
              ...c,
              conditions: c.conditions.filter((_, i) => i !== view.branch),
            };
          }
          if (c.type === "or" || c.type === "not or") {
            return {
              ...c,
              conditions: c.conditions.map((branch) => updateNested(branch)),
            };
          }
          return c;
        });
      return updateNested(cons);
    });
    setViewStack((vs) =>
      vs.slice(0, -1).concat({
        uid: view.uid,
        branch: view.branch === 0 ? 0 : view.branch - 1,
      }),
    );
    setTimeout(() => handleSave(), 0);
  }, [view, viewCondition, setConditions, handleSave]);

  // Main view
  if (view.uid === nodeType) {
    return (
      <div className={"overflow-auto p-4"}>
        <H6
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ minWidth: 144, display: "inline-block" }}>FIND</span>
          <InputGroup
            autoFocus
            defaultValue={DEFAULT_RETURN_NODE}
            disabled
            className="roamjs-query-return-node"
          />
          <span
            style={{
              flexGrow: 1,
              display: "inline-block",
              minWidth: 144,
            }}
          >
            WHERE
          </span>
        </H6>
        {conditions.map((con, index) => (
          <QueryCondition
            key={con.uid}
            con={con}
            index={index}
            getAvailableVariables={getAvailableVariables}
            setConditions={setConditions}
            setView={(v) => setViewStack([...viewStack, v])}
            onSave={handleSave}
            onDelete={deleteCondition}
          />
        ))}
        <div style={{ display: "flex" }}>
          <span style={{ minWidth: 144, display: "inline-block" }}>
            <Button
              rightIcon={"plus"}
              text={"Add Condition"}
              style={{ maxHeight: 32 }}
              onClick={addCondition}
            />
          </span>
        </div>
      </div>
    );
  }

  // Nested OR/NOT OR view
  return (
    <div className={"p-4"}>
      <div>
        <h4>OR Branches</h4>
        <Tabs
          renderActiveTabPanelOnly={true}
          selectedTabId={view.branch}
          onChange={(e) =>
            setViewStack(
              viewStack
                .slice(0, -1)
                .concat([{ uid: view.uid, branch: Number(e) }]),
            )
          }
        >
          {viewCondition &&
            Array(viewCondition.conditions.length)
              .fill(null)
              .map((_, j) => (
                <Tab
                  key={j}
                  id={j}
                  title={`${j + 1}`}
                  panel={
                    <>
                      {viewConditions.map((con, index) => (
                        <QueryCondition
                          key={con.uid}
                          con={con}
                          index={index}
                          getAvailableVariables={getAvailableVariables}
                          setConditions={nestedSetConditions}
                          setView={(v) => setViewStack([...viewStack, v])}
                          onSave={handleSave}
                          onDelete={deleteCondition}
                        />
                      ))}
                    </>
                  }
                />
              ))}
        </Tabs>
        <div style={{ display: "flex" }}>
          <span style={{ minWidth: 144, display: "inline-block" }}>
            <Button
              icon={"arrow-left"}
              text={"Back"}
              style={{ maxHeight: 32 }}
              onClick={() => setViewStack(viewStack.slice(0, -1))}
            />
          </span>
          <span style={{ minWidth: 144, display: "inline-block" }}>
            <Button
              rightIcon={"plus"}
              text={"Add Condition"}
              style={{ maxHeight: 32 }}
              onClick={addCondition}
            />
          </span>
          <span style={{ minWidth: 144, display: "inline-block" }}>
            <Button
              rightIcon={"plus"}
              text={"Add Branch"}
              style={{ maxHeight: 32 }}
              onClick={createBranch}
            />
          </span>
          <span style={{ minWidth: 144, display: "inline-block" }}>
            <Button
              disabled={viewCondition?.conditions.length === 1}
              rightIcon={"trash"}
              text={"Delete Branch"}
              style={{ maxHeight: 32 }}
              onClick={deleteBranch}
            />
          </span>
        </div>
      </div>
    </div>
  );
};

export default DiscourseNodeQueryEditor;
