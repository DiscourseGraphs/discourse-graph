import { DAILY_NOTE_PAGE_TITLE_REGEX } from "roamjs-components/date/constants";
import parseNlpDate from "roamjs-components/date/parseNlpDate";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import startOfDay from "date-fns/startOfDay";
import endOfDay from "date-fns/endOfDay";
import type {
  DatalogAndClause,
  DatalogClause,
  PullBlock,
} from "roamjs-components/types";
import { Condition } from "./types";
import gatherDatalogVariablesFromClause from "./gatherDatalogVariablesFromClause";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageTitlesStartingWithPrefix from "roamjs-components/queries/getPageTitlesStartingWithPrefix";
import extractRef from "roamjs-components/util/extractRef";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";

type ConditionToDatalog = (condition: Condition) => DatalogClause[];

const INPUT_REGEX = /^:in /;

const isRegex = (str: string) => /^\/.+\/(i)?$/.test(str);
const regexRePatternValue = (str: string) => {
  const isCaseInsensitive = str.endsWith("/i");
  return isCaseInsensitive
    ? `"(?i)${str.slice(1, -2).replace(/\\/g, "\\\\")}"`
    : `"${str.slice(1, -1).replace(/\\/g, "\\\\")}"`;
};
const getTitleDatalog = ({
  source,
  target,
  uid,
}: {
  source: string;
  target: string;
  uid?: string;
}): DatalogClause[] => {
  const dateMatch = /^\s*{date(?::([^}]+))?}\s*$/i.exec(target);
  if (dateMatch) {
    const nlp = dateMatch[1] || "";
    if (nlp) {
      const date = parseNlpDate(nlp);
      return [
        {
          type: "data-pattern",
          arguments: [
            { type: "variable", value: source },
            { type: "constant", value: ":node/title" },
            {
              type: "constant",
              value: `"${window.roamAlphaAPI.util.dateToPageTitle(date)}"`,
            },
          ],
        },
      ];
    } else {
      return [
        {
          type: "data-pattern",
          arguments: [
            { type: "variable", value: source },
            { type: "constant", value: ":node/title" },
            { type: "variable", value: `${source}-Title` },
          ],
        },
        {
          type: "fn-expr",
          fn: "re-pattern",
          arguments: [
            {
              type: "constant",
              value: `"${DAILY_NOTE_PAGE_TITLE_REGEX.source}"`,
            },
          ],
          binding: {
            type: "bind-scalar",
            variable: { type: "variable", value: `date-regex` },
          },
        },
        {
          type: "pred-expr",
          pred: "re-find",
          arguments: [
            { type: "variable", value: "date-regex" },
            { type: "variable", value: `${source}-Title` },
          ],
        },
      ];
    }
  }
  const currentMatch = /^\s*{current}\s*$/i.test(target);
  if (currentMatch) {
    // Can't use this, since it's async
    // window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
    const mainWindowUid = getCurrentPageUid();
    return [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":node/title" },
          {
            type: "constant",
            value: `"${getPageTitleByPageUid(mainWindowUid)}"`,
          },
        ],
      },
    ];
  }
  const thisPageMatch = /^\s*{this page}\s*$/i.test(target);
  if (thisPageMatch && uid) {
    return [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":node/title" },
          {
            type: "constant",
            value: `"${getPageTitleByBlockUid(uid)}"`,
          },
        ],
      },
    ];
  }
  const currentUserMatch = /^\s*{current user}\s*$/i.test(target);
  if (currentUserMatch) {
    return [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":node/title" },
          { type: "constant", value: `"${getCurrentUserDisplayName()}"` },
        ],
      },
    ];
  }
  if (isRegex(target)) {
    const rePattern = regexRePatternValue(target);
    return [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":node/title" },
          { type: "variable", value: `${source}-Title` },
        ],
      },
      {
        type: "fn-expr",
        fn: "re-pattern" as const,
        arguments: [
          {
            type: "constant",
            value: rePattern,
          },
        ],
        binding: {
          type: "bind-scalar",
          variable: { type: "variable", value: `${target}-regex` },
        },
      },
      {
        type: "pred-expr",
        pred: "re-find",
        arguments: [
          { type: "variable", value: `${target}-regex` },
          { type: "variable", value: `${source}-Title` },
        ],
      },
    ];
  }
  if (INPUT_REGEX.test(target)) {
    return [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":node/title" },
          { type: "variable", value: target.replace(INPUT_REGEX, "") },
        ],
      },
    ];
  }
  return [
    {
      type: "data-pattern",
      arguments: [
        { type: "variable", value: source },
        { type: "constant", value: ":node/title" },
        { type: "constant", value: `"${normalizePageTitle(target)}"` },
      ],
    },
  ];
};

type Translator = {
  callback: (args: {
    source: string;
    target: string;
    uid: string;
  }) => DatalogClause[];
  targetOptions?: string[] | ((source: string) => string[]);
  placeholder?: string;
  isVariable?: true;
};

const translator: Record<string, Translator> = {
  self: {
    callback: ({ source }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/uid" },
          { type: "constant", value: `"${source}"` },
        ],
      },
    ],
  },
  references: {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/refs" },
          { type: "variable", value: target },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "is referenced by": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: target },
          { type: "constant", value: ":block/refs" },
          { type: "variable", value: source },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "is referenced by block in page with title": {
    callback: ({ source, target, uid }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: `${target}-RefBy` },
          { type: "constant", value: ":block/refs" },
          { type: "variable", value: source },
        ],
      },
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: `${target}-RefBy` },
          { type: "constant", value: ":block/page" },
          { type: "variable", value: target },
        ],
      },
      ...getTitleDatalog({ source: target, target, uid }),
    ],
    placeholder: "Enter any placeholder for the node",
    targetOptions: () =>
      getAllPageNames().concat([
        "{date}",
        "{date:today}",
        "{current}",
        "{current user}",
        "{this page}",
      ]),
  },
  "is in page": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/page" },
          { type: "variable", value: target },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "has title": {
    callback: getTitleDatalog,
    targetOptions: () =>
      getAllPageNames().concat([
        "{date}",
        "{date:today}",
        "{current}",
        "{current user}",
        "{this page}",
      ]),
    placeholder: "Enter a page name or {date} for any DNP",
  },
  "with text in title": {
    callback: ({ source, target }) => {
      const initialDatalog: DatalogClause[] = [
        {
          type: "data-pattern",
          arguments: [
            { type: "variable", value: source },
            { type: "constant", value: ":node/title" },
            { type: "variable", value: `${source}-Title` },
          ],
        },
      ];
      const currentMatch = /^\s*{current}\s*$/i.test(target);
      if (currentMatch) {
        const uid = getCurrentPageUid();
        return [
          ...initialDatalog,
          {
            type: "pred-expr",
            pred: "clojure.string/includes?",
            arguments: [
              { type: "variable", value: `${source}-Title` },
              {
                type: "constant",
                value: `"${getPageTitleByPageUid(uid)}"`,
              },
            ],
          },
        ];
      } else {
        return [
          ...initialDatalog,
          {
            type: "pred-expr",
            pred: "clojure.string/includes?",
            arguments: [
              { type: "variable", value: `${source}-Title` },
              { type: "constant", value: `"${normalizePageTitle(target)}"` },
            ],
          },
        ];
      }
    },
    targetOptions: ["{current}"],
    placeholder: "Enter any text",
  },
  "has attribute": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: `${target}-Attribute` },
          { type: "constant", value: ":node/title" },
          { type: "constant", value: `"${target}"` },
        ],
      },
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: target },
          { type: "constant", value: ":block/refs" },
          { type: "variable", value: `${target}-Attribute` },
        ],
      },
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: target },
          { type: "constant", value: ":block/parents" },
          { type: "variable", value: source },
        ],
      },
    ],
    targetOptions: getAllPageNames,
    placeholder: "Enter any attribute name",
    isVariable: true,
  },
  "has child": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/children" },
          { type: "variable", value: target },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "has parent": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: target },
          { type: "constant", value: ":block/children" },
          { type: "variable", value: source },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "has ancestor": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/parents" },
          { type: "variable", value: target },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "has descendant": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: target },
          { type: "constant", value: ":block/parents" },
          { type: "variable", value: source },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "with text": {
    callback: ({ source, target }) => {
      if (isRegex(target)) {
        const rePattern = regexRePatternValue(target);
        return [
          {
            type: "or-clause",
            clauses: [
              {
                type: "data-pattern",
                arguments: [
                  { type: "variable", value: source },
                  { type: "constant", value: ":block/string" },
                  { type: "variable", value: `${source}-String` },
                ],
              },
              {
                type: "data-pattern",
                arguments: [
                  { type: "variable", value: source },
                  { type: "constant", value: ":node/title" },
                  { type: "variable", value: `${source}-String` },
                ],
              },
            ],
          },
          {
            type: "fn-expr",
            fn: "re-pattern",
            arguments: [
              {
                type: "constant",
                value: rePattern,
              },
            ],
            binding: {
              type: "bind-scalar",
              variable: { type: "variable", value: `${target}-regex` },
            },
          },
          {
            type: "pred-expr",
            pred: "re-find",
            arguments: [
              { type: "variable", value: `${target}-regex` },
              { type: "variable", value: `${source}-String` },
            ],
          },
        ];
      } else {
        return [
          {
            type: "or-clause",
            clauses: [
              {
                type: "data-pattern",
                arguments: [
                  { type: "variable", value: source },
                  { type: "constant", value: ":block/string" },
                  { type: "variable", value: `${source}-String` },
                ],
              },
              {
                type: "data-pattern",
                arguments: [
                  { type: "variable", value: source },
                  { type: "constant", value: ":node/title" },
                  { type: "variable", value: `${source}-String` },
                ],
              },
            ],
          },
          {
            type: "pred-expr",
            pred: "clojure.string/includes?",
            arguments: [
              { type: "variable", value: `${source}-String` },
              { type: "constant", value: `"${normalizePageTitle(target)}"` },
            ],
          },
        ];
      }
    },
    placeholder: "Enter any text",
  },
  "created by": {
    callback: ({ source, target }) => {
      const initialDatalog: DatalogClause[] = [
        {
          type: "data-pattern",
          arguments: [
            { type: "variable", value: source },
            { type: "constant", value: ":create/user" },
            { type: "variable", value: `${source}-User` },
          ],
        },
        {
          type: "data-pattern",
          arguments: [
            { type: "variable", value: `${source}-User` },
            { type: "constant", value: ":user/display-page" },
            { type: "variable", value: `${source}-User-Display` },
          ],
        },
      ];
      return INPUT_REGEX.test(target)
        ? [
            ...initialDatalog,
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: `${source}-User-Display` },
                { type: "constant", value: ":node/title" },
                {
                  type: "variable",
                  value: target.replace(INPUT_REGEX, ""),
                },
              ],
            },
          ]
        : [
            ...initialDatalog,
            ...getTitleDatalog({ source: `${source}-User-Display`, target }),
          ];
    },
    targetOptions: () =>
      (
        window.roamAlphaAPI.data.fast.q(
          `[:find (pull ?n [:node/title]) :where [?u :user/display-page ?n]]`,
        ) as [PullBlock][]
      )
        .map((d) => d[0][":node/title"] || "")
        .concat(["{current user}"]),
    placeholder: "Enter the display name of any user with access to this graph",
  },
  "edited by": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":edit/user" },
          { type: "variable", value: `${source}-User` },
        ],
      },
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: `${source}-User` },
          { type: "constant", value: ":user/display-page" },
          { type: "variable", value: `${source}-User-Display` },
        ],
      },
      ...getTitleDatalog({ source: `${source}-User-Display`, target }),
    ],
    targetOptions: () =>
      (
        window.roamAlphaAPI.data.fast.q(
          `[:find (pull ?n [:node/title]) :where [?u :user/display-page ?n]]`,
        ) as [PullBlock][]
      )
        .map((d) => d[0][":node/title"] || "")
        .concat(["{current user}"]),
    placeholder: "Enter the display name of any user with access to this graph",
  },
  "references title": {
    callback: ({ source, target, uid }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/refs" },
          { type: "variable", value: `${target}-Ref` },
        ],
      },
      ...getTitleDatalog({ source: `${target}-Ref`, target, uid }),
    ],
    targetOptions: () =>
      getAllPageNames().concat([
        "{date}",
        "{date:today}",
        "{current}",
        "{current user}",
        "{this page}",
      ]),
    placeholder: "Enter a page name or {date} for any DNP",
  },
  "has heading": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/heading" },
          { type: "constant", value: target },
        ],
      },
    ],
    targetOptions: ["1", "2", "3", "0"],
    placeholder: "Enter a heading value (0, 1, 2, 3)",
  },
  "is in page with title": {
    callback: ({ source, target, uid }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/page" },
          { type: "variable", value: target },
        ],
      },
      ...getTitleDatalog({ source: target, target, uid }),
    ],
    targetOptions: () =>
      getAllPageNames().concat([
        "{date}",
        "{date:today}",
        "{current}",
        "{current user}",
        "{this page}",
      ]),
    placeholder: "Enter a page name or {date} for any DNP",
  },
  "created after": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":create/time" },
          { type: "variable", value: `${source}-CreateTime` },
        ],
      },
      {
        type: "pred-expr",
        pred: "<",
        arguments: [
          { type: "constant", value: `${parseNlpDate(target).valueOf()}` },
          { type: "variable", value: `${source}-CreateTime` },
        ],
      },
    ],
    placeholder: "Enter any natural language date value",
  },
  "created before": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":create/time" },
          { type: "variable", value: `${source}-CreateTime` },
        ],
      },
      {
        type: "pred-expr",
        pred: ">",
        arguments: [
          { type: "constant", value: `${parseNlpDate(target).valueOf()}` },
          { type: "variable", value: `${source}-CreateTime` },
        ],
      },
    ],
    placeholder: "Enter any natural language date value",
  },
  "edited after": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":edit/time" },
          { type: "variable", value: `${source}-EditTime` },
        ],
      },
      {
        type: "pred-expr",
        pred: "<",
        arguments: [
          { type: "constant", value: `${parseNlpDate(target).valueOf()}` },
          { type: "variable", value: `${source}-EditTime` },
        ],
      },
    ],
    placeholder: "Enter any natural language date value",
  },
  "edited before": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":edit/time" },
          { type: "variable", value: `${source}-EditTime` },
        ],
      },
      {
        type: "pred-expr",
        pred: ">",
        arguments: [
          { type: "constant", value: `${parseNlpDate(target).valueOf()}` },
          { type: "variable", value: `${source}-EditTime` },
        ],
      },
    ],
    placeholder: "Enter any natural language date value",
  },
  "titled before": {
    callback: ({ source, target }) => {
      const sourceLog: DatalogClause = {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":log/id" },
          { type: "variable", value: `${source}-Log` },
        ],
      };
      return INPUT_REGEX.test(target)
        ? [
            sourceLog,
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: `${target}-Date` },
                { type: "constant", value: ":node/title" },
                { type: "variable", value: target.replace(INPUT_REGEX, "") },
              ],
            },
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: `${target}-Date` },
                { type: "constant", value: ":log/id" },
                { type: "variable", value: `${target}-Log` },
              ],
            },
            {
              type: "pred-expr",
              pred: ">",
              arguments: [
                {
                  type: "variable",
                  value: `${target}-Log`,
                },
                { type: "variable", value: `${source}-Log` },
              ],
            },
          ]
        : [
            sourceLog,
            {
              type: "pred-expr",
              pred: ">",
              arguments: [
                {
                  type: "constant",
                  value: `${startOfDay(parseNlpDate(target)).valueOf()}`,
                },
                { type: "variable", value: `${source}-Log` },
              ],
            },
          ];
    },
    placeholder: "Enter any natural language date value",
  },
  "titled after": {
    callback: ({ source, target }) => {
      const sourceLog: DatalogClause = {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":log/id" },
          { type: "variable", value: `${source}-Log` },
        ],
      };
      return INPUT_REGEX.test(target)
        ? [
            sourceLog,
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: `${target}-Date` },
                { type: "constant", value: ":node/title" },
                { type: "variable", value: target.replace(INPUT_REGEX, "") },
              ],
            },
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: `${target}-Date` },
                { type: "constant", value: ":log/id" },
                { type: "variable", value: `${target}-Log` },
              ],
            },
            {
              type: "pred-expr",
              pred: "<",
              arguments: [
                {
                  type: "variable",
                  value: `${target}-Log`,
                },
                { type: "variable", value: `${source}-Log` },
              ],
            },
          ]
        : [
            sourceLog,
            {
              type: "pred-expr",
              pred: "<",
              arguments: [
                {
                  type: "constant",
                  value: `${endOfDay(parseNlpDate(target)).valueOf()}`,
                },
                { type: "variable", value: `${source}-Log` },
              ],
            },
          ];
    },
    placeholder: "Enter any natural language date value",
  },
  "is in canvas": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/uid" },
          { type: "variable", value: `${source}-uid` },
        ],
      },
      ...getTitleDatalog({ source: `${target}-Canvas`, target }),
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: `${target}-Canvas` },
          { type: "constant", value: ":block/props" },
          { type: "variable", value: `${target}-Canvas-Props` },
        ],
      },
      {
        type: "fn-expr",
        fn: "get",
        arguments: [
          { type: "variable", value: `${target}-Canvas-Props` },
          { type: "constant", value: ":roamjs-query-builder" },
        ],
        binding: {
          type: "bind-scalar",
          variable: { type: "variable", value: `${target}-Canvas-RQB` },
        },
      },
      {
        type: "fn-expr",
        fn: "get",
        arguments: [
          { type: "variable", value: `${target}-Canvas-RQB` },
          { type: "constant", value: ":tldraw" },
        ],
        binding: {
          type: "bind-rel",
          args: [
            { type: "variable", value: `${target}-TLDraw-Key` },
            { type: "variable", value: `${target}-TLDraw-Value` },
          ],
        },
      },
      {
        type: "fn-expr",
        fn: "get",
        arguments: [
          { type: "variable", value: `${target}-TLDraw-Value` },
          { type: "constant", value: ":props" },
        ],
        binding: {
          type: "bind-scalar",
          variable: { type: "variable", value: `${target}-Shape-Props` },
        },
      },
      {
        type: "fn-expr",
        fn: "get",
        arguments: [
          { type: "variable", value: `${target}-Shape-Props` },
          { type: "constant", value: ":uid" },
        ],
        binding: {
          type: "bind-scalar",
          variable: { type: "variable", value: `${source}-uid` },
        },
      },
    ],
    targetOptions: () =>
      // TODO - use roam depot setting
      getPageTitlesStartingWithPrefix("Canvas/").concat(["{current}"]),
    placeholder: "Enter a page name",
  },
  "has block reference": {
    callback: ({ source, target }) => {
      if (INPUT_REGEX.test(target)) {
        return [
          {
            type: "data-pattern",
            arguments: [
              { type: "variable", value: source },
              { type: "constant", value: ":block/uid" },
              { type: "variable", value: target.replace(INPUT_REGEX, "") },
            ],
          },
        ];
      }
      return [
        {
          type: "data-pattern",
          arguments: [
            { type: "variable", value: source },
            { type: "constant", value: ":block/uid" },
            {
              type: "constant",
              value: `"${extractRef(target)}"`,
            },
          ],
        },
      ];
    },
    placeholder: "Enter a block reference (with or without brackets)",
  },
};

export const registerDatalogTranslator = ({
  key,
  ...translation
}: Translator & { key: string }) => {
  translator[key] = translation;
  return () => unregisterDatalogTranslator({ key });
};

export const unregisterDatalogTranslator = ({ key }: { key: string }) =>
  delete translator[key];

export const getConditionLabels = () =>
  Object.keys(translator)
    .filter((k) => k !== "self")
    .sort((a, b) => b.length - a.length);

const conditionToDatalog: ConditionToDatalog = (con) => {
  if (con.type === "or" || con.type === "not or") {
    const clauses: DatalogAndClause[] = con.conditions.map((branch) => ({
      type: "and-clause",
      clauses: branch.flatMap((c) => conditionToDatalog(c)),
    }));
    const variableSet: Record<string, number> = {};
    clauses.forEach((c) => {
      const gathered = gatherDatalogVariablesFromClause(c);
      gathered.forEach((v) => {
        variableSet[v] = (variableSet[v] || 0) + 1;
      });
    });
    const datalog = [
      {
        type: "or-join-clause",
        clauses,
        variables: Object.entries(variableSet)
          .filter(([_, v]) => v === clauses.length)
          .map(([value]) => ({
            type: "variable",
            value,
          })),
      },
    ] as DatalogClause[];
    if (con.type === "not or")
      return [{ type: "not-clause", clauses: datalog }];
    return datalog;
  }
  const { relation, ...condition } = con;
  const datalogTranslator =
    translator[relation] ||
    Object.entries(translator).find(([k]) =>
      new RegExp(relation, "i").test(k),
    )?.[1];
  const datalog = datalogTranslator?.callback?.(condition) || [];
  if (datalog.length && (con.type === "not" || con.not))
    return [{ type: "not-clause", clauses: datalog }];
  return datalog;
};

export const sourceToTargetOptions = ({
  source,
  relation,
}: {
  source: string;
  relation: string;
}): string[] => {
  const targetOptions = translator[relation]?.targetOptions;
  if (!targetOptions) return [];
  if (typeof targetOptions === "function") return targetOptions(source);
  return targetOptions;
};

export const sourceToTargetPlaceholder = ({
  relation,
}: {
  relation: string;
}): string => {
  return translator[relation]?.placeholder || "Enter Value";
};

export const isTargetVariable = ({
  relation,
}: {
  relation: string;
}): boolean => {
  return translator[relation]?.isVariable || false;
};

export default conditionToDatalog;
