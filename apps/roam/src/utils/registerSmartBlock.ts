import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import { InputTextNode, OnloadArgs, TreeNode } from "roamjs-components/types";
import { extractRef } from "roamjs-components/util";
import registerSmartBlocksCommand from "roamjs-components/util/registerSmartBlocksCommand";
import resolveQueryBuilderRef from "./resolveQueryBuilderRef";
import runQuery from "./runQuery";
import createBlock from "roamjs-components/writes/createBlock";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import getCurrentUserEmail from "roamjs-components/queries/getCurrentUserEmail";
import createPage from "roamjs-components/writes/createPage";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";

export const registerSmartBlock = (onloadArgs: OnloadArgs) => {
  const { extensionAPI } = onloadArgs;
  registerSmartBlocksCommand({
    text: "QUERYBUILDER",
    delayArgs: true,
    help: "Run an existing query block and output the results.\n\n1. The reference to the query block\n2. The format to output each result\n3. (Optional) The number of results returned",
    handler: ({ proccessBlockText, variables, processBlock }) =>
      function runQueryBuilderCommand(arg, ...args) {
        const inputArgs = args.filter((a) => a.includes("="));
        const regularArgs = args.filter((a) => !a.includes("="));
        const lastArg = regularArgs[regularArgs.length - 1];
        const lastArgIsLimitArg = !Number.isNaN(Number(lastArg));
        const { format: formatArg, limit } = lastArgIsLimitArg
          ? {
              format: regularArgs.slice(0, -1).join(","),
              limit: Number(lastArg),
            }
          : { format: regularArgs.join(","), limit: 0 };
        const formatArgAsUid = extractRef(formatArg);
        const format = isLiveBlock(formatArgAsUid)
          ? {
              text: getTextByBlockUid(formatArgAsUid),
              children: getBasicTreeByParentUid(formatArgAsUid),
              uid: formatArgAsUid,
            }
          : { text: formatArg || "{text}", children: [], uid: "" };
        const queryRef = variables[arg] || arg;
        const parentUid = resolveQueryBuilderRef({ queryRef, extensionAPI });
        return runQuery({
          parentUid,
          extensionAPI,
          inputs: Object.fromEntries(
            inputArgs
              .map((i) => i.split("=").slice(0, 2) as [string, string])
              .map(([k, v]) => [k, variables[v] || v]),
          ),
        }).then(({ allProcessedResults }) => {
          const results = limit
            ? allProcessedResults.slice(0, limit)
            : allProcessedResults;
          return results
            .map((r) =>
              Object.fromEntries(
                Object.entries(r).map(([k, v]) => [
                  k.toLowerCase(),
                  typeof v === "string"
                    ? v
                    : typeof v === "number"
                      ? v.toString()
                      : v instanceof Date
                        ? window.roamAlphaAPI.util.dateToPageTitle(v)
                        : "",
                ]),
              ),
            )
            .flatMap((r) => {
              if (processBlock && format.uid) {
                const blockFormatter = (node: InputTextNode) => () => {
                  Object.entries(r).forEach(([k, v]) => {
                    variables[k] = v;
                  });
                  return processBlock(node);
                };
                return format.text
                  ? blockFormatter(format)
                  : format.children.map(blockFormatter);
              }

              const s = format.text.replace(
                /{([^}]+)}/g,
                (_, i: string) => r[i.toLowerCase()],
              );
              return [() => proccessBlockText(s)];
            })
            .reduce(
              (prev, cur) => prev.then((p) => cur().then((c) => p.concat(c))),
              Promise.resolve([] as InputTextNode[]),
            );
        });
      },
  });

  registerSmartBlocksCommand({
    text: "PERSONALHOMEPAGE",
    handler: (context) => async () => {
      try {
        const currentUser = getCurrentUserDisplayName();
        const homePageTitle = `${currentUser}/Home`;
        let pageUid = getPageUidByPageTitle(homePageTitle);
        if (!pageUid) {
          await createPage({
            title: homePageTitle,
          });

          pageUid = getPageUidByPageTitle(homePageTitle);
        }

        const tree = getFullTreeByParentUid(pageUid);

        const isPageContentEmpty = (node: TreeNode): boolean => {
          if (node.text && node.text === homePageTitle) {
            return (
              node.children.length === 0 ||
              node.children.every((childNode: TreeNode) =>
                isChildEmpty(childNode),
              )
            );
          }

          return isChildEmpty(node);
        };

        const isChildEmpty = (node: TreeNode): boolean => {
          const isCurrentNodeEmpty = !node.text || node.text.trim() === "";
          if (!node.children || node.children.length === 0) {
            return isCurrentNodeEmpty;
          }
          return (
            isCurrentNodeEmpty &&
            node.children.every((childNode: TreeNode) =>
              isChildEmpty(childNode),
            )
          );
        };

        const isPageEmpty = isPageContentEmpty(tree);

        if (isPageEmpty) {
          await createBlock({
            node: {
              text: `{{Create Homepage:SmartBlock:InsertHomepageTemplate}}`,
            },
            parentUid: pageUid,
          });
        }

        window.roamAlphaAPI.ui.mainWindow.openPage({
          page: { title: homePageTitle },
        });

        return [""];
      } catch (error) {
        return [
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ];
      }
    },
  });
};
