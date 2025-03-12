import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Icon,
  Tooltip,
  InputGroup,
  Popover,
  Menu,
  MenuItem,
  Switch,
  Intent,
  Label,
  Divider,
  HTMLTable,
} from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { Filters } from "roamjs-components/components/Filter";
import getSubTree from "roamjs-components/util/getSubTree";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import createBlock from "roamjs-components/writes/createBlock";
import Export from "~/components/Export";
import parseQuery from "~/utils/parseQuery";
import { getDatalogQuery } from "~/utils/fireQuery";
import parseResultSettings, {
  Sorts,
  InputValues,
} from "~/utils/parseResultSettings";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";
import postProcessResults from "~/utils/postProcessResults";
import setInputSetting from "roamjs-components/util/setInputSetting";
import getUids from "roamjs-components/dom/getUids";
import Charts from "./Charts";
import Timeline from "./Timeline";
import Kanban from "./Kanban";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { RoamBasicNode } from "roamjs-components/types";
import { render as renderToast } from "roamjs-components/components/Toast";
import { Column, Result } from "~/utils/types";
import updateBlock from "roamjs-components/writes/updateBlock";
import { Condition } from "~/utils/types";
import ResultsTable from "./ResultsTable";
import { render as renderSimpleAlert } from "roamjs-components/components/SimpleAlert";
import setInputSettings from "roamjs-components/util/setInputSettings";
import posthog from "posthog-js";
import { Inputs } from "./Inputs";

const VIEWS: Record<string, { value: boolean }> = {
  link: { value: false },
  plain: { value: false },
  embed: { value: false },
  alias: { value: true },
};

const EMBED_FOLD_VALUES = ["default", "open", "closed"]; // waiting for roamAlphaAPI to add a open/close to renderBlock

type EnglishQueryPart = { text: string; clickId?: string };

const QueryUsed = ({ parentUid }: { parentUid: string }) => {
  const { datalogQuery, englishQuery } = useMemo(() => {
    const args = parseQuery(parentUid);
    const { query: datalogQuery } = getDatalogQuery(args);
    const toEnglish = (c: Condition, level = 0): EnglishQueryPart[][] =>
      c.type === "or" || c.type === "not or"
        ? [
            [{ text: `${"".padStart(level * 2, " ")}OR` }],
            ...c.conditions.flatMap((cc) => [
              [{ text: `${"".padStart((level + 1) * 2, " ")}AND` }],
              ...cc.flatMap((ccc) => toEnglish(ccc, level + 2)),
            ]),
          ]
        : [
            [
              {
                text: `${"".padStart(level * 2, " ")}${
                  c.type === "not" ? "NOT " : ""
                }`,
              },
              { text: c.source, clickId: `${c.uid}-source` },
              { text: c.relation, clickId: `${c.uid}-relation` },
              { text: c.target, clickId: `${c.uid}-target` },
            ],
          ];
    const englishQuery: EnglishQueryPart[][] = [
      [{ text: `FIND` }, { text: args.returnNode }, { text: "WHERE" }],
      ...args.conditions.flatMap((c) => toEnglish(c)),
      ...args.selections.map((s) => [
        { text: "SELECT" },
        { text: s.text, clickId: `${s.uid}-select` },
        { text: "AS" },
        { text: s.label, clickId: `${s.uid}-as` },
      ]),
    ];
    return { datalogQuery, englishQuery };
  }, [parentUid]);
  const [isEnglish, setIsEnglish] = useState(true);
  return (
    <div
      style={{
        fontSize: 10,
        position: "relative",
        display: "flex",
        padding: "8px",
      }}
      className={"roamjs-query-used"}
    >
      <div
        style={{
          flexShrink: 0,
          width: 100,
        }}
      >
        <style>{`.roamjs-query-results-lang.bp3-control.bp3-switch .bp3-control-indicator-child:first-child {
    height: 0;
}`}</style>
        <Switch
          className={"roamjs-query-results-lang"}
          checked={isEnglish}
          onChange={(e) => setIsEnglish((e.target as HTMLInputElement).checked)}
          innerLabelChecked={"ENG"}
          innerLabel={"DATA"}
        />
        <Tooltip
          content={isEnglish ? "Copy English Query" : "Copy Datalog Query"}
          position={"right"}
          openOnTargetFocus={false}
          lazy={true}
          hoverOpenDelay={250}
          autoFocus={false}
        >
          <Button
            minimal
            icon={"clipboard"}
            onClick={(e) => {
              const queryEl = (e.target as HTMLInputElement)
                ?.closest(".roamjs-query-used")
                ?.querySelector(".roamjs-query-used-text") as HTMLElement;
              navigator.clipboard.writeText(queryEl.innerText);
            }}
          />
        </Tooltip>
      </div>
      <div
        className={"roamjs-query-used-text"}
        style={{
          whiteSpace: "pre-wrap",
          fontFamily: isEnglish ? "inherit" : "monospace",
        }}
      >
        {isEnglish
          ? englishQuery.map((q, i) => (
              <span key={i} style={{ margin: 0, display: "block" }}>
                {q.map((p, j) => (
                  <span
                    key={j}
                    style={{
                      margin: 0,
                      cursor: p.clickId ? "pointer" : "inherit",
                    }}
                    onClick={() => {
                      if (!p.clickId) return;
                      const el = document.getElementById(p.clickId);
                      if (!el) return;
                      el.focus();
                    }}
                  >
                    {j !== 0 ? " " : ""}
                    {p.text}
                  </span>
                ))}
              </span>
            ))
          : datalogQuery.split("\n").map((q, i) => (
              <span key={i} style={{ margin: 0, display: "block" }}>
                {q}
              </span>
            ))}
      </div>
    </div>
  );
};

const SUPPORTED_COLUMN_FILTER_TYPES = [
  { id: "contains" },
  { id: "equals" },
  { id: "greater than" },
  { id: "less than" },
];

const SUPPORTED_LAYOUTS = [
  {
    id: "table",
    icon: "join-table",
    settings: [
      {
        key: "rowStyle",
        label: "Row Style",
        options: ["Striped", "Bare"],
      },
    ],
  },
  { id: "line", icon: "chart", settings: [] },
  {
    id: "bar",
    icon: "vertical-bar-chart-asc",
    settings: [],
  },
  {
    id: "timeline",
    icon: "timeline-events",
    settings: [],
  },
  {
    id: "kanban",
    icon: "heat-grid",
    settings: [
      { key: "key", label: "Group By", options: "columns" },
      { key: "display", label: "Display", options: "columns" },
      { key: "legend", label: "Show Legend", options: ["No", "Yes"] },
    ],
  },
] as const;
const settingsById = Object.fromEntries(
  SUPPORTED_LAYOUTS.map((l) => [l.id, l.settings]),
);

type ResultsViewComponent = (props: {
  parentUid: string;
  columns: Column[];
  header?: React.ReactNode;
  results: Result[];
  hideResults?: boolean;
  hideMenu?: boolean;
  preventSavingSettings?: boolean;
  onEdit?: () => void;
  onDeleteQuery?: () => void;
  onRefresh: (loadInBackground?: boolean) => void;
  globalFiltersData?: Record<string, Filters>;
  globalPageSize?: number;
  isEditBlock?: boolean;
  exportIsOpen?: boolean;
  toggleExport?: (isOpen: boolean) => void;
  // @deprecated - should be inferred from the query or layout
  onResultsInViewChange?: (r: Result[]) => void;
}) => JSX.Element;

const head = (s: string | string[]) => (Array.isArray(s) ? s[0] || "" : s);

type MenuHeadingProps = {
  onClear: () => void;
  text: string;
  classNames?: string;
};
const MenuHeading: FC<MenuHeadingProps> = ({
  onClear,
  text,
  classNames = "",
}) => {
  return (
    <h4
      className={`mt-0 flex items-center justify-between font-bold ${classNames}`}
    >
      {text}
      <Button icon="small-cross" onClick={onClear} minimal small />
    </h4>
  );
};

const ResultsView: ResultsViewComponent = ({
  parentUid,
  columns,
  header,
  results,
  hideResults = false,
  hideMenu = false,
  preventSavingSettings = false,
  onEdit,
  onDeleteQuery,
  onRefresh,
  onResultsInViewChange,
  isEditBlock,
  exportIsOpen = false,
  toggleExport,
}) => {
  const extensionAPI = useExtensionAPI();
  const settings = useMemo(
    () => parseResultSettings(parentUid, columns, extensionAPI),
    [parentUid],
  );
  const [activeSort, setActiveSort] = useState(settings.activeSort);
  const resultViewSetActiveSort = React.useCallback(
    (as: Sorts) => {
      setActiveSort(as);
      if (preventSavingSettings) return;
      const sortsNode = getSubTree({
        key: "sorts",
        parentUid: settings.resultNodeUid,
      });
      sortsNode.children.forEach((c) => deleteBlock(c.uid));
      as.map((a) => ({
        text: a.key,
        children: [{ text: `${a.descending}` }],
      })).forEach((node, order) =>
        createBlock({
          parentUid: sortsNode.uid,
          node,
          order,
        }),
      );
    },
    [setActiveSort, preventSavingSettings, parentUid],
  );

  // @deprecated - use columnFilters
  const [filters, setFilters] = useState(settings.filters);
  const [random, setRandom] = useState({ count: settings.random });
  const [page, setPage] = useState(settings.page);
  const [pageSize, setPageSize] = useState(settings.pageSize);
  const pageSizeTimeoutRef = useRef(0);
  const [views, setViews] = useState(settings.views);
  const [columnFilters, setColumnFilters] = useState(settings.columnFilters);
  const [searchFilter, setSearchFilter] = useState(settings.searchFilter);
  const [showInterface, setShowInterface] = useState(settings.showInterface);
  const [revealMenuIcons, setRevealMenuIcons] = useState(false);
  const [showInputs, setShowInputs] = useState(settings.showInputs);
  const hideMenuIcons = hideMenu || (!revealMenuIcons && !showInterface);

  const { allProcessedResults, paginatedResults } = useMemo(() => {
    return postProcessResults(results, {
      activeSort,
      filters,
      columnFilters,
      random: random.count,
      page,
      pageSize,
      searchFilter,
      showInterface,
    });
  }, [
    results,
    activeSort,
    filters,
    page,
    pageSize,
    random.count,
    searchFilter,
    columnFilters,
  ]);

  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    onResultsInViewChange?.(paginatedResults);
  }, [paginatedResults]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isEditViews, setIsEditViews] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  useEffect(() => {
    setIsExportOpen(exportIsOpen);
  }, [exportIsOpen]);
  const handleCloseExport = () => {
    if (toggleExport) {
      toggleExport(false);
    }
    setIsExportOpen(false);
  };
  const [isEditRandom, setIsEditRandom] = useState(false);
  const [isEditLayout, setIsEditLayout] = useState(false);
  const [isEditColumnSort, setIsEditColumnSort] = useState(false);
  const [isEditColumnFilter, setIsEditColumnFilter] = useState(false);
  const [isEditSearchFilter, setIsEditSearchFilter] = useState(false);

  const [layout, setLayout] = useState(settings.layout);
  const layoutMode = useMemo(
    () => (Array.isArray(layout.mode) ? layout.mode[0] : layout.mode),
    [layout],
  );
  const isMenuIconDirty = useMemo(
    () =>
      searchFilter ||
      columnFilters.length ||
      random.count ||
      (activeSort.length && layout.mode !== "table"), // indicator is on ResultHeader
    [searchFilter, columnFilters, random, activeSort, layout.mode],
  );
  const onViewChange = (view: (typeof views)[number], i: number) => {
    const newViews = views.map((v, j) => (i === j ? view : v));
    setViews(newViews);

    if (preventSavingSettings) return;
    const viewsNode = getSubTree({
      key: "views",
      parentUid: settings.resultNodeUid,
    });
    viewsNode.children.forEach((c) => deleteBlock(c.uid));

    newViews
      .map((v) => ({
        text: v.column,
        children: [
          { text: v.mode, children: v.value ? [{ text: v.value }] : [] },
        ],
      }))
      .forEach((node, order) =>
        createBlock({
          node,
          order,
          parentUid: viewsNode.uid,
        }),
      );
  };
  const debounceRef = useRef(0);
  const showColumnViewOptions = views.some(
    (view) => VIEWS[view.mode]?.value === true,
  );

  return (
    <div
      className={`roamjs-query-results-view relative w-full mode-${layout.mode}`}
      ref={containerRef}
      onMouseEnter={() => setRevealMenuIcons(true)}
      onMouseLeave={() => setRevealMenuIcons(false)}
    >
      {isEditSearchFilter && (
        <div
          className="w-full p-4"
          style={{
            background: "#eeeeee80",
          }}
        >
          <InputGroup
            fill={true}
            placeholder="Search"
            value={searchFilter}
            onChange={(e) => {
              window.clearTimeout(debounceRef.current);
              setSearchFilter(e.target.value);
              if (preventSavingSettings) return;
              setInputSetting({
                key: "searchFilter",
                value: e.target.value,
                blockUid: settings.resultNodeUid,
              });
            }}
            rightElement={
              <Button
                hidden={!searchFilter}
                icon={"remove"}
                onClick={() => {
                  setSearchFilter("");
                  if (preventSavingSettings) return;
                  setInputSetting({
                    key: "searchFilter",
                    value: "",
                    blockUid: settings.resultNodeUid,
                  });
                }}
                minimal
              />
            }
          />
        </div>
      )}
      <Inputs
        show={showInputs}
        parentUid={parentUid}
        resultsNodeUid={settings.resultNodeUid}
        initialInputs={settings.inputs}
        onRefresh={onRefresh}
      />
      <Export
        title="Share Query Results"
        isOpen={isExportOpen}
        onClose={handleCloseExport}
        results={allProcessedResults}
        columns={columns}
      />
      {header}
      <div className="relative">
        <div
          style={hideMenuIcons ? { display: "none" } : {}}
          className="absolute right-0 z-10 p-1"
        >
          {onRefresh && (
            <Tooltip content={"Refresh Results"}>
              <Button icon={"refresh"} minimal onClick={() => onRefresh()} />
            </Tooltip>
          )}
          <Popover
            onOpening={() => {
              setIsEditRandom(false);
              setIsEditLayout(false);
              setIsEditColumnFilter(false);
              setIsEditViews(false);
              setIsEditColumnSort(false);
            }}
            autoFocus={false}
            enforceFocus={false}
            placement="left-end"
            isOpen={moreMenuOpen}
            target={
              <Button
                minimal
                icon={"more"}
                className={isMenuIconDirty ? "roamjs-item-dirty" : ""}
              />
            }
            onInteraction={(next, e) => {
              if (!e) return;
              const target = e.target as HTMLElement;
              if (
                target.classList.contains("bp3-menu-item") ||
                target.closest(".bp3-menu-item")
              ) {
                return;
              }
              setMoreMenuOpen(next);
            }}
            content={
              isEditRandom ? (
                <div className="relative p-4">
                  <MenuHeading
                    onClear={() => setIsEditRandom(false)}
                    text="Get Random"
                  />
                  <InputGroup
                    type={"number"}
                    min={0}
                    value={random.count.toString()}
                    className="inline-block w-20 pr-2"
                    onChange={(e) => {
                      setRandom({ count: Number(e.target.value) });
                      if (preventSavingSettings) return;
                      setInputSetting({
                        key: "random",
                        value: e.target.value,
                        blockUid: settings.resultNodeUid,
                      });
                    }}
                  />
                  <Button
                    hidden={random.count === 0}
                    icon={"remove"}
                    onClick={() => {
                      setRandom({ count: 0 });
                      if (preventSavingSettings) return;
                      setInputSetting({
                        key: "random",
                        value: "0",
                        blockUid: settings.resultNodeUid,
                      });
                    }}
                    minimal
                  />
                </div>
              ) : isEditLayout ? (
                <div className="relative w-72 p-4">
                  <MenuHeading
                    onClear={() => setIsEditLayout(false)}
                    text="Layout"
                  />
                  <div className="mb-4 grid grid-cols-3 gap-4">
                    {SUPPORTED_LAYOUTS.map((l) => (
                      <div
                        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border p-2 ${
                          l.id === layoutMode
                            ? "border-blue-800 border-opacity-75 text-blue-800"
                            : "border-gray-800 border-opacity-25 text-gray-800"
                        }`}
                        onClick={() => {
                          posthog.capture("Results View: Layout Changed", {
                            pageUid: parentUid,
                            oldLayout: layoutMode,
                            newLayout: l.id,
                          });

                          setLayout({ ...layout, mode: l.id });
                          const resultNode = getSubTree({
                            key: "results",
                            parentUid,
                          });
                          const layoutNode = getSubTree({
                            key: "layout",
                            parentUid: resultNode.uid,
                          });
                          setInputSetting({
                            key: "mode",
                            value: l.id,
                            blockUid: layoutNode.uid,
                          });
                        }}
                      >
                        <Icon icon={l.icon} />
                        <span className="text-sm capitalize">{l.id}</span>
                      </div>
                    ))}
                  </div>
                  {settingsById[layoutMode].map((s) => {
                    const options =
                      s.options === "columns"
                        ? columns.map((c) => c.key)
                        : s.options.slice();
                    return (
                      <Label key={s.key}>
                        {s.label}
                        <MenuItemSelect
                          activeItem={head(layout[s.key]) || options[0]}
                          onItemSelect={(value) => {
                            setLayout({ ...layout, [s.key]: value });
                            const resultNode = getSubTree({
                              key: "results",
                              parentUid,
                            });
                            const layoutNode = getSubTree({
                              key: "layout",
                              parentUid: resultNode.uid,
                            });
                            setInputSetting({
                              key: s.key,
                              value,
                              blockUid: layoutNode.uid,
                            });
                            // TODO: replace this with an `onSettingChange` in SUPPORTED_LAYOUTS
                            if (s.options === "columns") {
                              setInputSettings({
                                key: "columns",
                                blockUid: layoutNode.uid,
                                values: [],
                              });
                            }
                          }}
                          items={options}
                        />
                      </Label>
                    );
                  })}
                </div>
              ) : isEditColumnSort ? (
                <div className="relative p-4">
                  <h4 className="flex items-center justify-between p-2 font-bold">
                    Set Sort
                    <Button
                      icon={"small-cross"}
                      onClick={() => setIsEditColumnSort(false)}
                      minimal
                      small
                    />
                  </h4>
                  <div className="flex flex-col items-start gap-4 overflow-auto p-2">
                    {activeSort.map(({ key, descending }) => (
                      <div key={key}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="mr-3 w-24 truncate">{key}</div>
                          {/* TODO: change to checkbox */}
                          <MenuItemSelect
                            items={["Ascending", "Descending"]}
                            activeItem={descending ? "Descending" : "Ascending"}
                            onItemSelect={(value) => {
                              const descending = value === "Descending";
                              resultViewSetActiveSort(
                                activeSort.map((s) =>
                                  s.key === key ? { key, descending } : s,
                                ),
                              );
                            }}
                          />
                          <Button
                            icon={"trash"}
                            minimal
                            onClick={() => {
                              resultViewSetActiveSort(
                                activeSort.filter((s) => s.key !== key),
                              );
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <MenuItemSelect
                      items={columns
                        .map((c) => c.key)
                        .filter((c) => !activeSort.some((as) => as.key === c))}
                      transformItem={(k) =>
                        k.length > 10 ? `${k.slice(0, 7)}...` : k
                      }
                      ButtonProps={{
                        text: "Choose Column",
                        intent: "primary",
                        disabled: columns.length === activeSort.length,
                      }}
                      onItemSelect={(column) => {
                        resultViewSetActiveSort([
                          ...activeSort,
                          { key: column, descending: false },
                        ]);
                      }}
                    />
                  </div>
                </div>
              ) : isEditColumnFilter ? (
                <div
                  className="relative max-w-2xl p-4"
                  style={{ minWidth: "320px" }}
                >
                  <MenuHeading
                    onClear={() => setIsEditColumnFilter(false)}
                    text="Filters"
                  />
                  <div className="flex flex-col items-start gap-4 py-2">
                    {columnFilters.map(({ key, type, value, uid }) => (
                      <div key={uid}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <MenuItemSelect
                            className="roamjs-column-filter-key"
                            items={columns.map((c) => c.key)}
                            transformItem={(k) =>
                              k.length > 10 ? `${k.slice(0, 7)}...` : k
                            }
                            activeItem={key}
                            onItemSelect={(newKey) => {
                              setColumnFilters(
                                columnFilters.map((f) =>
                                  f.uid === uid ? { ...f, key: newKey } : f,
                                ),
                              );
                              updateBlock({ uid, text: newKey });
                            }}
                          />
                          <MenuItemSelect
                            className="roamjs-column-filter-type flex-grow"
                            items={SUPPORTED_COLUMN_FILTER_TYPES.map(
                              (c) => c.id,
                            )}
                            activeItem={type}
                            onItemSelect={(newType) => {
                              setColumnFilters(
                                columnFilters.map((f) =>
                                  f.uid === uid ? { ...f, type: newType } : f,
                                ),
                              );
                              setInputSetting({
                                blockUid: uid,
                                key: "type",
                                value: newType,
                              });
                            }}
                          />
                          <Button
                            icon={"trash"}
                            minimal
                            onClick={() => {
                              setColumnFilters(
                                columnFilters.filter((f) => f.uid !== uid),
                              );
                              deleteBlock(uid);
                            }}
                          />
                        </div>
                        <div>
                          {type === "equals" ? (
                            <MultiSelect
                              popoverProps={{
                                minimal: true,
                                position: "bottom-left",
                                boundary: "viewport",
                              }}
                              selectedItems={value.map((v) => v.toString())}
                              tagRenderer={(tag) => tag}
                              tagInputProps={{
                                tagProps: { className: "max-w-lg" },
                              }}
                              itemRenderer={(item, props) => (
                                <MenuItem
                                  key={item}
                                  text={item}
                                  active={props.modifiers.active}
                                  onClick={props.handleClick}
                                />
                              )}
                              items={Array.from(
                                new Set(
                                  results
                                    .map((r) => r[key].toString())
                                    .filter((v) => !value.includes(v)),
                                ),
                              )}
                              onRemove={(newValue) => {
                                setColumnFilters(
                                  columnFilters.map((f) =>
                                    f.uid === uid
                                      ? {
                                          ...f,
                                          value: value.filter(
                                            (v) => v !== newValue,
                                          ),
                                        }
                                      : f,
                                  ),
                                );
                                setInputSettings({
                                  blockUid: uid,
                                  key: "value",
                                  values: value.filter((v) => v !== newValue),
                                });
                              }}
                              onItemSelect={(newValue) => {
                                setColumnFilters(
                                  columnFilters.map((f) =>
                                    f.uid === uid
                                      ? { ...f, value: [...value, newValue] }
                                      : f,
                                  ),
                                );
                                setInputSettings({
                                  blockUid: uid,
                                  key: "value",
                                  values: [...value, newValue],
                                });
                              }}
                            />
                          ) : (
                            <InputGroup
                              className="roamjs-column-filter-value"
                              value={value[0]}
                              placeholder="Type a value ..."
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setColumnFilters(
                                  columnFilters.map((f) =>
                                    f.uid === uid
                                      ? { ...f, value: [newValue] }
                                      : f,
                                  ),
                                );
                                setInputSettings({
                                  blockUid: uid,
                                  key: "value",
                                  values: [newValue],
                                });
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    <Button
                      text={"Add Filter"}
                      intent="primary"
                      onClick={() => {
                        const newFilter = {
                          key: columns[0].key,
                          type: SUPPORTED_COLUMN_FILTER_TYPES[0].id,
                          value: [""],
                          uid: window.roamAlphaAPI.util.generateUID(),
                        };
                        setColumnFilters([...columnFilters, newFilter]);
                        const columnFiltersNode = getSubTree({
                          key: "columnFilters",
                          parentUid: settings.resultNodeUid,
                        });
                        createBlock({
                          parentUid: columnFiltersNode.uid,
                          order: Number.MAX_VALUE,
                          node: {
                            text: newFilter.key,
                            uid: newFilter.uid,
                            children: [
                              {
                                text: "type",
                                children: [{ text: newFilter.type }],
                              },
                              {
                                text: "value",
                                children: [{ text: newFilter.value[0] }],
                              },
                            ],
                          },
                        });
                      }}
                      rightIcon={"plus"}
                    />
                  </div>
                </div>
              ) : isEditViews ? (
                <div
                  style={{ minWidth: "26rem" }}
                  className="roamjs-query-column-views relative max-w-md p-4"
                >
                  <MenuHeading
                    onClear={() => setIsEditViews(false)}
                    text="Column Views"
                  />
                  <HTMLTable className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-xs font-medium uppercase tracking-wider !text-gray-500">
                          Column
                        </th>
                        <th className="text-xs font-medium uppercase tracking-wider !text-gray-500">
                          View
                        </th>
                        {showColumnViewOptions && (
                          <th className="text-xs font-medium uppercase tracking-wider !text-gray-500">
                            Options
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {views.map(({ column, mode, value }, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap">{column}</td>
                          <td className="whitespace-nowrap">
                            <MenuItemSelect
                              className="roamjs-view-select"
                              items={Object.keys(VIEWS)}
                              activeItem={mode}
                              onItemSelect={(m) => {
                                posthog.capture(
                                  "Results View: Column View Changed",
                                  {
                                    pageUid: parentUid,
                                    oldMode: mode,
                                    newMode: m,
                                  },
                                );

                                onViewChange({ mode: m, column, value }, i);
                              }}
                            />
                          </td>
                          {showColumnViewOptions && (
                            <td className="whitespace-nowrap">
                              {mode === "alias" && (
                                <InputGroup
                                  value={value}
                                  onChange={(e) =>
                                    onViewChange(
                                      {
                                        mode,
                                        column,
                                        value: e.target.value,
                                      },
                                      i,
                                    )
                                  }
                                />
                              )}
                              {/* {mode === "embed" && (
                                <div className="flex items-center">
                                  <MenuItemSelect
                                    className="roamjs-view-select"
                                    items={EMBED_FOLD_VALUES}
                                    activeItem={
                                      !!value ? value : EMBED_FOLD_VALUES[0]
                                    }
                                    onItemSelect={(value) => {
                                      onViewChange({ mode, column, value }, i);
                                    }}
                                  />
                                  <Tooltip content="Initial folded state">
                                    <Icon
                                      icon="info-sign"
                                      iconSize={12}
                                      className="opacity-80 ml-2 align-middle"
                                    />
                                  </Tooltip>
                                </div>
                              )} */}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </HTMLTable>
                </div>
              ) : (
                <Menu>
                  {onEdit && (
                    <MenuItem
                      active={false}
                      icon={"annotation"}
                      text={"Edit Query"}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onEdit();
                      }}
                    />
                  )}
                  <Divider />
                  <MenuItem
                    icon={"list"}
                    text={"Results"}
                    className={isMenuIconDirty ? "roamjs-item-dirty" : ""}
                  >
                    <MenuItem
                      icon={"layout"}
                      text={"Layout"}
                      onClick={() => {
                        setIsEditLayout(true);
                      }}
                    />
                    <MenuItem
                      icon={"eye-open"}
                      text={"Column Views"}
                      onClick={() => {
                        setIsEditViews(true);
                      }}
                    />
                    <MenuItem
                      icon={isEditSearchFilter ? "zoom-out" : "search"}
                      text={isEditSearchFilter ? "Hide Search" : "Search"}
                      className={searchFilter ? "roamjs-item-dirty" : ""}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setIsEditSearchFilter((prevState) => !prevState);
                      }}
                    />
                    <MenuItem
                      icon={showInputs ? "minus" : "plus"}
                      text={showInputs ? "Hide Inputs" : "Inputs"}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setShowInputs(!showInputs);
                        setInputSetting({
                          blockUid: settings.resultNodeUid,
                          key: "showInputs",
                          value: showInputs ? "hide" : "show",
                        });
                      }}
                    />
                    <MenuItem
                      icon={"filter"}
                      text={"Filters"}
                      className={
                        columnFilters.length ? "roamjs-item-dirty" : ""
                      }
                      onClick={() => {
                        setIsEditColumnFilter(true);
                      }}
                    />
                    <MenuItem
                      icon={"sort"}
                      text={"Sort"}
                      className={activeSort.length ? "roamjs-item-dirty" : ""}
                      onClick={() => {
                        setIsEditColumnSort(true);
                      }}
                    />
                    <MenuItem
                      icon={"random"}
                      text={"Get Random"}
                      className={random.count ? "roamjs-item-dirty" : ""}
                      onClick={() => setIsEditRandom(true)}
                    />
                  </MenuItem>
                  <MenuItem
                    icon={showInterface ? "th-disconnect" : "th"}
                    text={showInterface ? "Hide Interface" : "Show Interface"}
                    onClick={() => {
                      const resultNode = getSubTree({
                        key: "results",
                        parentUid,
                      });
                      setInputSetting({
                        key: "interface",
                        value: showInterface ? "hide" : "show",
                        blockUid: resultNode.uid,
                      });
                      setShowInterface((s) => !s);
                      setMoreMenuOpen(false);
                    }}
                  />
                  <MenuItem
                    icon={"export"}
                    text={"Share Data"}
                    onClick={async () => {
                      posthog.capture("Results View: Share Data Clicked", {
                        parentUid: parentUid,
                        resultCount: results.length,
                        columnCount: columns.length,
                        layout: layoutMode,
                      });
                      if (!results.length) {
                        onRefresh();
                      }
                      setMoreMenuOpen(false);
                      setIsExportOpen(true);
                    }}
                  />
                  <Divider />
                  {isEditBlock && (
                    <MenuItem
                      icon={"edit"}
                      text={"Edit Block"}
                      onClick={() => {
                        const location = getUids(
                          containerRef.current?.closest(
                            ".roam-block",
                          ) as HTMLDivElement,
                        );
                        window.roamAlphaAPI.ui.setBlockFocusAndSelection({
                          location: {
                            "window-id": location.windowId,
                            "block-uid": location.blockUid,
                          },
                        });
                      }}
                    />
                  )}
                  <MenuItem
                    icon={"clipboard"}
                    text={"Copy Query"}
                    onClick={() => {
                      const getTextFromTreeToPaste = (
                        items: RoamBasicNode[],
                        indentLevel = 0,
                      ): string => {
                        const indentation = "    ".repeat(indentLevel);

                        return items
                          .map((item) => {
                            const childrenText =
                              item.children.length > 0
                                ? getTextFromTreeToPaste(
                                    item.children,
                                    indentLevel + 1,
                                  )
                                : "";
                            return `${indentation}- ${item.text}\n${childrenText}`;
                          })
                          .join("");
                      };
                      const tree = getBasicTreeByParentUid(parentUid);
                      navigator.clipboard.writeText(
                        "- {{query block}}\n" + getTextFromTreeToPaste(tree, 1),
                      );
                      renderToast({
                        id: "query-copy",
                        content: "Copied Query",
                        intent: Intent.PRIMARY,
                      });
                    }}
                  />
                  {onDeleteQuery && (
                    <>
                      <MenuItem
                        icon={"trash"}
                        text={"Delete Query"}
                        onClick={() => {
                          renderSimpleAlert({
                            content:
                              "Are you sure you want to delete this query?",
                            onConfirm: onDeleteQuery,
                            onCancel: true,
                          });
                        }}
                      />
                    </>
                  )}
                </Menu>
              )
            }
          />
        </div>

        {!hideResults && (
          <>
            {results.length !== 0 ? (
              layoutMode === "table" ? (
                <ResultsTable
                  layout={layout}
                  columns={columns}
                  results={paginatedResults}
                  parentUid={settings.resultNodeUid}
                  activeSort={activeSort}
                  setActiveSort={resultViewSetActiveSort}
                  filters={filters}
                  setFilters={setFilters}
                  views={views}
                  page={page}
                  setPage={setPage}
                  pageSize={pageSize}
                  setPageSize={setPageSize}
                  pageSizeTimeoutRef={pageSizeTimeoutRef}
                  onRefresh={onRefresh}
                  allProcessedResults={allProcessedResults}
                  allResults={results}
                  showInterface={showInterface}
                />
              ) : layoutMode === "line" ? (
                <Charts
                  type="line"
                  data={allProcessedResults}
                  columns={columns.slice(1)}
                />
              ) : layoutMode === "bar" ? (
                <Charts
                  type="bar"
                  data={allProcessedResults}
                  columns={columns.slice(1)}
                />
              ) : layoutMode === "timeline" ? (
                <Timeline timelineElements={allProcessedResults} />
              ) : layoutMode === "kanban" ? (
                <Kanban
                  data={allProcessedResults}
                  layout={layout}
                  onQuery={() => onRefresh(true)}
                  resultKeys={columns}
                  parentUid={parentUid}
                  views={views}
                  activeSort={activeSort}
                  setActiveSort={resultViewSetActiveSort}
                  pageSize={pageSize}
                  setPage={setPage}
                  showInterface={showInterface}
                  page={page}
                  pageSizeTimeoutRef={pageSizeTimeoutRef}
                  setPageSize={setPageSize}
                />
              ) : (
                <div style={{ padding: "16px 8px" }}>
                  Layout `{layoutMode}` is not supported
                </div>
              )
            ) : (
              <div
                className="mb-0 flex items-center justify-between"
                style={{ padding: "16px 8px" }}
              >
                <i>No Results Found</i>
              </div>
            )}
            <div
              style={
                !showInterface
                  ? { display: "none" }
                  : { background: "#eeeeee80" }
              }
            >
              <div
                className="flex items-center justify-between px-1 text-xs"
                style={{
                  opacity: 0.8,
                  padding: 4,
                }}
              >
                <span>
                  <i style={{ opacity: 0.8 }}>
                    <Button
                      icon={showContent ? "caret-down" : "caret-right"}
                      minimal
                      small
                      onClick={() => setShowContent(!showContent)}
                      style={{
                        minWidth: 16,
                        minHeight: 16,
                      }}
                    />
                    Showing {paginatedResults.length} of {results.length}{" "}
                    results
                  </i>
                </span>
              </div>
              {showContent && <QueryUsed parentUid={parentUid} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResultsView;
