import { DAILY_NOTE_PAGE_TITLE_REGEX } from "roamjs-components/date/constants";
import { Result } from "roamjs-components/types/query-builder";
import extractTag from "roamjs-components/util/extractTag";
import parseResultSettings from "./parseResultSettings";

const transform = (_val: Result[string]) =>
  typeof _val === "string"
    ? DAILY_NOTE_PAGE_TITLE_REGEX.test(extractTag(_val))
      ? window.roamAlphaAPI.util.pageTitleToDate(extractTag(_val)) || new Date()
      : /^(-)?\d+(\.\d*)?$/.test(_val)
        ? Number(_val)
        : _val
    : _val;
const sortFunction =
  (key: string, descending?: boolean) => (a: Result, b: Result) => {
    const _aVal = a[key];
    const _bVal = b[key];
    const aVal = transform(_aVal);
    const bVal = transform(_bVal);
    if (aVal instanceof Date && bVal instanceof Date) {
      return descending
        ? bVal.valueOf() - aVal.valueOf()
        : aVal.valueOf() - bVal.valueOf();
    } else if (typeof aVal === "number" && typeof bVal === "number") {
      return descending ? bVal - aVal : aVal - bVal;
    } else if (typeof aVal !== "undefined" && typeof bVal !== "undefined") {
      return descending
        ? bVal.toString().localeCompare(aVal.toString())
        : aVal.toString().localeCompare(bVal.toString());
    } else {
      return 0;
    }
  };

const postProcessResults = (
  results: Result[],
  settings: Omit<
    ReturnType<typeof parseResultSettings>,
    "views" | "layout" | "resultNodeUid"
  >,
) => {
  const sortedResults = results
    .filter((r) => {
      const deprecatedFilter = Object.keys(settings.filters).every(
        (filterKey) => {
          const includeValues =
            settings.filters[filterKey].includes.values || new Set();
          const excludeValues =
            settings.filters[filterKey].excludes.values || new Set();
          return (
            (includeValues.size === 0 &&
              (typeof r[filterKey] !== "string" ||
                !excludeValues.has(extractTag(r[filterKey] as string))) &&
              (r[filterKey] instanceof Date ||
                !excludeValues.has(
                  window.roamAlphaAPI.util.dateToPageTitle(
                    // @ts-ignore FIX LATER
                    r[filterKey] as Date,
                  ),
                )) &&
              !excludeValues.has(r[filterKey] as string)) ||
            (typeof r[filterKey] === "string" &&
              includeValues.has(extractTag(r[filterKey] as string))) ||
            (r[filterKey] instanceof Date &&
              includeValues.has(
                window.roamAlphaAPI.util.dateToPageTitle(r[filterKey] as Date),
              )) ||
            includeValues.has(r[filterKey] as string)
          );
        },
      );
      if (!deprecatedFilter) return false;
      return settings.columnFilters.every((columnFilter) => {
        switch (columnFilter.type) {
          case "contains":
            const resultValue = r[columnFilter.key];
            const resultValueString =
              typeof resultValue === "string" ? resultValue : `${resultValue}`;
            return resultValueString.includes(columnFilter.value[0]);
          case "equals":
            if (
              columnFilter.value.length === 1 &&
              columnFilter.value[0] === ""
            ) {
              return true;
            }
            return columnFilter.value.some((v) => r[columnFilter.key] === v);
          case "greater than":
            const gtFilter = transform(columnFilter.value[0]);
            const gtResult = transform(r[columnFilter.key]);
            return gtResult > gtFilter;
          case "less than":
            const ltFilter = transform(columnFilter.value[0]);
            const ltResult = transform(r[columnFilter.key]);
            return ltResult < ltFilter;
          default:
            return true;
        }
      });
    })
    .filter((r) => {
      return settings.searchFilter
        ? Object.keys(r)
            .filter((key) => !key.endsWith("-uid") && key !== "uid")
            .some((key) =>
              String(r[key])
                .toLowerCase()
                .includes(settings.searchFilter.toLowerCase()),
            )
        : true;
    })
    .sort((a, b) => {
      for (const sort of settings.activeSort) {
        const cmpResult = sortFunction(sort.key, sort.descending)(a, b);
        if (cmpResult !== 0) return cmpResult;
      }
      return 0;
    });
  const allProcessedResults =
    settings.random > 0
      ? sortedResults.sort(() => 0.5 - Math.random()).slice(0, settings.random)
      : sortedResults;
  const paginatedResults = allProcessedResults.slice(
    (settings.page - 1) * settings.pageSize,
    settings.page * settings.pageSize,
  );
  return { results, allProcessedResults, paginatedResults };
};

export default postProcessResults;
