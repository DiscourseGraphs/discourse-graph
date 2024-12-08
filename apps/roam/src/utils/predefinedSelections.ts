import type { DatalogClause, PullBlock } from "roamjs-components/types";
import { DAILY_NOTE_PAGE_REGEX } from "roamjs-components/date/constants";
import differenceInSeconds from "date-fns/differenceInSeconds";
import differenceInMinutes from "date-fns/differenceInMinutes";
import differenceInHours from "date-fns/differenceInHours";
import differenceInDays from "date-fns/differenceInDays";
import differenceInWeeks from "date-fns/differenceInWeeks";
import differenceInMonths from "date-fns/differenceInMonths";
import differenceInYears from "date-fns/differenceInYears";
import datefnsFormat from "date-fns/format";
import type { QBClause, Result as QueryResult } from "./types";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import parseQuery from "./parseQuery";
import toCellValue from "./toCellValue";
import createBlock from "roamjs-components/writes/createBlock";

const ALIAS_TEST = /^node$/i;
const REGEX_TEST = /\/([^}]*)\//;
const CREATE_DATE_TEST = /^\s*created?\s*(date|time|since)\s*$/i;
const EDIT_DATE_TEST = /^\s*edit(?:ed)?\s*(date|time|since)\s*$/i;
const CREATE_BY_TEST = /^\s*(author|create(d)?\s*by)\s*$/i;
const EDIT_BY_TEST = /^\s*(last\s*)?edit(ed)?\s*by\s*$/i;
const SUBTRACT_TEST = /^subtract\(([^,)]+),([^,)]+)\)$/i;
const ADD_TEST = /^add\(([^,)]+),([^,)]+)\)$/i;
const NODE_TEST = /^node:(\s*[^:]+\s*)(:.*)?$/i;
const ACTION_TEST = /^action:\s*([^:]+)\s*(?::(.*))?$/i;
const DATE_FORMAT_TEST = /^date-format\(([^,)]+),([^,)]+)\)$/i;
const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

const getArgValue = (key: string, result: QueryResult) => {
  if (/^today$/i.test(key)) return new Date();
  const val = result[key];
  if (typeof val === "string" && DAILY_NOTE_PAGE_REGEX.test(val))
    return (
      window.roamAlphaAPI.util.pageTitleToDate(
        DAILY_NOTE_PAGE_REGEX.exec(val)?.[0] || ""
      ) || new Date()
    );
  return val;
};

const getUserDisplayNameById = (id?: number) => {
  if (!id) {
    return "Anonymous User";
  }
  const pageId = window.roamAlphaAPI.pull("[:user/display-page]", id)?.[
    ":user/display-page"
  ]?.[":db/id"];
  if (!pageId) {
    return "Anonymous User";
  }
  return (
    window.roamAlphaAPI.pull("[:node/title]", pageId)?.[":node/title"] ||
    "Anonymous User"
  );
};

const formatDate = ({
  regex,
  key,
  value,
}: {
  regex: RegExp;
  key: string;
  value?: number;
}) => {
  const exec = regex.exec(key);
  const date = new Date(value || 0);
  const arg = exec?.[1] || "";
  const parseArg = () => {
    if (/since/i.test(arg)) {
      const now = new Date();
      const yearsAgo = differenceInYears(now, date);
      if (yearsAgo > 0) {
        return `${yearsAgo} year${yearsAgo === 1 ? "" : "s"} ago`;
      }
      const monthsAgo = differenceInMonths(now, date);
      if (monthsAgo > 0) {
        return `${monthsAgo} month${monthsAgo === 1 ? "" : "s"} ago`;
      }
      const weeksAgo = differenceInWeeks(now, date);
      if (weeksAgo > 0) {
        return `${weeksAgo} week${weeksAgo === 1 ? "" : "s"} ago`;
      }
      const daysAgo = differenceInDays(now, date);
      if (daysAgo > 0) {
        return `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
      }
      const hoursAgo = differenceInHours(now, date);
      if (hoursAgo > 0) {
        return `${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago`;
      }
      const minutesAgo = differenceInMinutes(now, date);
      if (minutesAgo > 0) {
        return `${minutesAgo} minute${minutesAgo === 1 ? "" : "s"} ago`;
      }
      const secondsAgo = differenceInSeconds(now, date);
      return `${secondsAgo} second${secondsAgo === 1 ? "" : "s"} ago`;
    }
    if (/time/i.test(arg)) {
      return `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
    }
    return date;
  };
  return {
    "": date,
    "-display": parseArg(),
  };
};

const flatten = (blocks: PullBlock[] = []): PullBlock[] =>
  blocks.flatMap((b) => [b, ...flatten(b[":block/children"])]);

const getBlockAttribute = (key: string, r: PullBlock) => {
  const blocks = flatten(
    window.roamAlphaAPI.pull(
      "[:block/string :block/uid {:block/children ...}]",
      [":block/uid", r[":block/uid"] || ""]
    )?.[":block/children"]
  );
  const block = blocks.find((blk) =>
    (blk[":block/string"] || "").startsWith(key + "::")
  );
  return {
    "": (block?.[":block/string"] || "").slice(key.length + 2).trim(),
    "-uid": block?.[":block/uid"] || "",
  };
};

const isVariableExposed = (
  clauses: DatalogClause[],
  variable: string
): boolean =>
  clauses.some((c) => {
    switch (c.type) {
      case "data-pattern":
      case "fn-expr":
      case "pred-expr":
      case "rule-expr":
        return c.arguments.some((a) => a.value === variable);
      case "not-clause":
      case "or-clause":
      case "and-clause":
        return isVariableExposed(c.clauses, variable);
      case "not-join-clause":
      case "or-join-clause":
        return c.variables.some((v) => v.value === variable);
      default:
        return false;
    }
  });

export type SelectionSuggestion = {
  text: string;
  children?: SelectionSuggestion[];
};

export type PredefinedSelection = {
  test: RegExp;
  pull: (a: {
    returnNode: string;
    match: RegExpExecArray | null;
    where: DatalogClause[];
  }) => string;
  mapper: (
    r: PullBlock,
    key: string,
    result: QueryResult
  ) =>
    | QueryResult[string]
    | Record<string, QueryResult[string]>
    | Promise<QueryResult[string] | Record<string, QueryResult[string]>>;
  update?: (s: {
    uid: string;
    value: string;
    parentUid: string; // Of the query instance
    result: QueryResult;
    // TODO - we wouldn't need this if `NODE_TEST` was separated out and not so overloaded.
    selection: string;
    previousValue?: string;
  }) => Promise<void>;
  suggestions?: SelectionSuggestion[];
};

const TIME_SUGGESTIONS = [
  { text: "since" },
  { text: "time" },
  { text: "date" },
];
const CREATE_DATE_SUGGESTIONS: SelectionSuggestion[] = [
  {
    text: "created ",
    children: TIME_SUGGESTIONS,
  },
];
const EDIT_DATE_SUGGESTIONS: SelectionSuggestion[] = [
  { text: "edited ", children: TIME_SUGGESTIONS },
];
const CREATE_BY_SUGGESTIONS: SelectionSuggestion[] = [{ text: "created by" }];
const EDIT_BY_SUGGESTIONS: SelectionSuggestion[] = [{ text: "edited by" }];
// TOO SLOW
// const ATTR_SUGGESTIONS: SelectionSuggestion[] = (
//   window.roamAlphaAPI.data.fast.q(
//     `[:find
//   (pull ?page [:node/title])
// :where
// [?b :attrs/lookup _]
// [?b :entity/attrs ?a]
// [(untuple ?a) [[?c ?d]]]
// [(get ?d :value) ?s]
// [(untuple ?s) [?e ?uid]]
// [?page :block/uid ?uid]
// ]`
//   ) as [PullBlock][]
// ).map((p) => ({
//   text: p[0]?.[":node/title"] || "",
//   children: [],
// }));
const LEAF_SUGGESTIONS: SelectionSuggestion[] = CREATE_DATE_SUGGESTIONS.concat(
  EDIT_DATE_SUGGESTIONS
)
  .concat(CREATE_BY_SUGGESTIONS)
  .concat(EDIT_BY_SUGGESTIONS);
// .concat(ATTR_SUGGESTIONS);

const predefinedSelections: PredefinedSelection[] = [
  {
    test: CREATE_DATE_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:create/time])`,
    mapper: (r, key) => {
      return formatDate({
        regex: CREATE_DATE_TEST,
        key,
        value: r?.[":create/time"],
      });
    },
    suggestions: CREATE_DATE_SUGGESTIONS,
  },
  {
    test: EDIT_DATE_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:edit/time])`,
    mapper: (r, key) => {
      return formatDate({
        regex: EDIT_DATE_TEST,
        key,
        value: r?.[":edit/time"],
      });
    },
    suggestions: EDIT_DATE_SUGGESTIONS,
  },
  {
    test: CREATE_BY_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:create/user])`,
    mapper: (r) => {
      return getUserDisplayNameById(r?.[":create/user"]?.[":db/id"]);
    },
    suggestions: CREATE_BY_SUGGESTIONS,
  },
  {
    test: EDIT_BY_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:edit/user])`,
    mapper: (r) => {
      return getUserDisplayNameById(r?.[":edit/user"]?.[":db/id"]);
    },
    suggestions: EDIT_BY_SUGGESTIONS,
  },
  {
    test: NODE_TEST,
    pull: ({ match, returnNode, where }) => {
      const node = (match?.[1] || returnNode)?.trim();
      const field = (match?.[2] || "").trim().substring(1);
      const fields = CREATE_BY_TEST.test(field)
        ? `[:create/user]`
        : EDIT_BY_TEST.test(field)
        ? `[:edit/user]`
        : CREATE_DATE_TEST.test(field)
        ? `[:create/time]`
        : EDIT_DATE_TEST.test(field)
        ? `[:edit/time]`
        : REGEX_TEST.test(field)
        ? `[:node/title :block/string :block/uid]`
        : field
        ? `[:block/uid]`
        : `[:node/title :block/uid :block/string]`;

      return isVariableExposed(where, node) ? `(pull ?${node} ${fields})` : "";
    },
    mapper: (r, key) => {
      const match = (NODE_TEST.exec(key)?.[2] || "").substring(1);
      const field = Object.keys(r)[0];
      return field === ":create/time"
        ? formatDate({
            regex: CREATE_DATE_TEST,
            key: match,
            value: r?.[":create/time"],
          })
        : field === ":edit/time"
        ? formatDate({
            regex: EDIT_DATE_TEST,
            key: match,
            value: r?.[":edit/time"],
          })
        : field === ":create/user"
        ? getUserDisplayNameById(r?.[":create/user"]?.[":db/id"])
        : field === ":edit/user"
        ? getUserDisplayNameById(r?.[":edit/user"]?.[":db/id"])
        : REGEX_TEST.test(match)
        ? {
            "":
              new RegExp(match.slice(1, -1))
                .exec(r?.[":block/string"] || r?.[":node/title"] || "")
                ?.slice(-1)[0] || "",
            "-uid": r?.[":block/uid"] || "",
          }
        : match
        ? getBlockAttribute(match, r)
        : {
            "": r?.[":node/title"] || r[":block/string"] || "",
            "-uid": r?.[":block/uid"] || "",
          };
    },
    update: async ({ uid, value, selection, parentUid, result }) => {
      const match = (NODE_TEST.exec(selection)?.[2] || "").substring(1);
      // TODO - use selection to determine how to cover all cases
      if (REGEX_TEST.test(match)) {
        const blockText = getTextByBlockUid(uid);
        await updateBlock({
          uid,
          text: blockText.replace(new RegExp(match.slice(1, -1)), (s, g) => {
            if (g) {
              return s.replace(g, value);
            }
            return value;
          }),
        });
      } else if (match) {
        const blockText = getTextByBlockUid(uid);
        await updateBlock({
          uid,
          text: blockText.replace(/(?<=::\s*)[^\s].*$/, value),
        });
      } else {
        const { conditions } = parseQuery(parentUid);
        const selectedVar = selection.replace(/^\s*node:/, "");
        const introducedCondition = conditions.find(
          (c): c is QBClause => c.type === "clause" && c.target === selectedVar
        );
        if (introducedCondition?.relation === "references") {
          const sourceUid = result[
            `${introducedCondition.source}-uid`
          ] as string;
          if (sourceUid) {
            const blockText = getTextByBlockUid(sourceUid);
            await updateBlock({
              uid: sourceUid,
              text: blockText.replace(
                toCellValue({
                  value: result[selectedVar],
                  uid: result[`${selectedVar}-uid`],
                }),
                value
              ),
            });
          }
        }
      }
    },
    suggestions: [
      {
        text: "node:",
        children: [
          { text: "/^.+$/" },
          { text: "{{node}}:", children: LEAF_SUGGESTIONS },
          { text: "{{node}}" },
        ],
      },
    ],
  },
  {
    test: ALIAS_TEST,
    pull: () => "",
    mapper: (r) => {
      return "";
    },
    suggestions: [{ text: "node" }],
  },
  {
    test: SUBTRACT_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:db/id])`,
    mapper: (_, key, result) => {
      const exec = SUBTRACT_TEST.exec(key);
      const arg0 = exec?.[1] || "";
      const arg1 = exec?.[2] || "";
      const val0 = getArgValue(arg0, result);
      const val1 = getArgValue(arg1, result);
      if (val0 instanceof Date && val1 instanceof Date) {
        return Math.floor(
          (val0.valueOf() - val1.valueOf()) / MILLISECONDS_IN_DAY
        );
      } else if (val0 instanceof Date) {
        return new Date(
          val0.valueOf() - MILLISECONDS_IN_DAY * (Number(val1) || 0)
        );
      } else {
        return (Number(val0) || 0) - (Number(val1) || 0);
      }
    },
    suggestions: [{ text: "subtract({{selection}},[###])" }],
  },
  {
    test: ADD_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:db/id])`,
    mapper: (_, key, result) => {
      const exec = ADD_TEST.exec(key);
      const arg0 = exec?.[1] || "";
      const arg1 = exec?.[2] || "";
      const val0 = getArgValue(arg0, result);
      const val1 = getArgValue(arg1, result);
      if (val0 instanceof Date && val1 instanceof Date) {
        return val1;
      } else if (val0 instanceof Date) {
        return new Date(
          val0.valueOf() + MILLISECONDS_IN_DAY * (Number(val1) || 0)
        );
      } else if (val1 instanceof Date) {
        return new Date(
          val1.valueOf() + MILLISECONDS_IN_DAY * (Number(val0) || 0)
        );
      } else {
        return (Number(val0) || 0) + (Number(val1) || 0);
      }
    },
    suggestions: [{ text: "add({{selection}},[###])" }],
  },
  {
    test: DATE_FORMAT_TEST,
    pull: ({ match }) => {
      const arg0 = match?.[1];
      return `(pull ?${arg0} [:block/string :node/title :block/uid])`;
    },
    mapper: (pull, key) => {
      const exec = DATE_FORMAT_TEST.exec(key);
      const rawArg0 = pull[":block/string"] || pull[":node/title"] || "";
      const arg0 =
        typeof rawArg0 === "string" && DAILY_NOTE_PAGE_REGEX.test(rawArg0)
          ? window.roamAlphaAPI.util.pageTitleToDate(
              DAILY_NOTE_PAGE_REGEX.exec(rawArg0)?.[0] || ""
            ) || new Date()
          : rawArg0;
      const arg1 = exec?.[2] || "";
      const uid = pull[":block/uid"] || "";
      if (arg0 instanceof Date) {
        return {
          "": arg0,
          "-display": datefnsFormat(arg0, arg1),
          "-uid": uid,
        };
      } else {
        return { "": arg0, "-uid": uid, "-display": arg0 };
      }
    },
    suggestions: [{ text: "date-format({{node}},[MMM do, yyyy])" }],
  },
  {
    test: ACTION_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:block/uid])`,
    mapper: (r, key) => {
      const match = ACTION_TEST.exec(key);
      if (!match) return "";
      return {
        "": match[2],
        "-uid": r?.[":block/uid"] || "",
        "-action": match[1],
      };
    },
    suggestions: [
      {
        text: "action:",
        children: [
          {
            text: "canvas:",
            children: [
              { text: "add" },
              { text: "insert" },
              { text: "presentation" },
            ],
          },
          {
            text: "page:",
            children: [{ text: "add" }, { text: "insert" }, { text: "plus" }],
          },
          {
            text: "context:",
            children: [
              { text: "book" },
              { text: "document" }, // replace with { text: "eye-open" }, not supported yet
              { text: "maximize" },
            ],
          },
          {
            text: "discourse:",
            children: [
              { text: "flows" },
              { text: "graph" },
              { text: "layout" }, // replace with { text: "search-around" }, not supported yet
            ],
          },
        ],
      },
    ],
  },
  {
    test: /.*/,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:block/uid])`,
    mapper: (r, key) => {
      return getBlockAttribute(key, r);
    },
    update: async ({ uid, value, result, selection, previousValue }) => {
      const blockText = getTextByBlockUid(uid);
      if (!uid) {
        createBlock({
          parentUid: result.uid,
          node: {
            text: `${selection}:: ${value}`,
          },
        });
        return;
      }
      await updateBlock({
        uid,
        text: !previousValue
          ? `${selection}:: ${value}`
          : blockText.replace(previousValue, value),
      });
    },
    suggestions: [], // ATTR_SUGGESTIONS,
  },
];

const flattenSuggestions = (suggestions: SelectionSuggestion[]): string[] =>
  suggestions
    .map((s) => {
      if (s.children?.length) {
        return flattenSuggestions(s.children).map((c) => `${s.text}${c}`);
      } else {
        return s.text;
      }
    })
    .flat();

export const ALL_SELECTION_SUGGESTIONS = flattenSuggestions(
  predefinedSelections
    .map((s) => s.suggestions)
    .filter((s): s is SelectionSuggestion[] => !!s?.length)
    .flat()
);

export const registerSelection = (args: PredefinedSelection) => {
  predefinedSelections.splice(predefinedSelections.length - 1, 0, args);
  return () => {
    const index = predefinedSelections.indexOf(args);
    if (index >= 0) {
      predefinedSelections.splice(index, 1);
    }
  };
};

export default predefinedSelections;
