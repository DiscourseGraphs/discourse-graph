import { Card, Spinner } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import fireQuery from "../utils/fireQuery";
import parseQuery from "../utils/parseQuery";
import type { Result } from "roamjs-components/types/query-builder";
import ResultsView from "./ResultsView/ResultsView";
import ReactDOM from "react-dom";
import QueryEditor from "./QueryEditor";
import getSubTree from "roamjs-components/util/getSubTree";
import { createComponentRender } from "roamjs-components/components/ComponentContainer";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import { OnloadArgs } from "roamjs-components/types/native";
import ExtensionApiContextProvider, {
  useExtensionAPI,
} from "roamjs-components/components/ExtensionApiContext";
import { Column } from "../utils/types";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";

type QueryPageComponent = (props: {
  pageUid: string;
  isEditBlock?: boolean;
  showAlias?: boolean;
}) => JSX.Element;

type Props = Parameters<QueryPageComponent>[0];

const QueryBuilder = ({ pageUid, isEditBlock, showAlias }: Props) => {
  const extensionAPI = useExtensionAPI();
  const hideMetadata = useMemo(
    () => !!extensionAPI && !!extensionAPI.settings.get("hide-metadata"),
    [extensionAPI],
  );
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);
  const [isEdit, _setIsEdit] = useState(
    () => !!getSubTree({ tree, key: "editing" }).uid,
  );
  const [hasResults, setHasResults] = useState(
    () => !!getSubTree({ tree, key: "results" }).uid,
  );
  const setIsEdit = useCallback(
    (b: boolean) => {
      _setIsEdit(b);
      return b
        ? createBlock({
            parentUid: pageUid,
            node: { text: "editing" },
            order: 2,
          })
        : deleteBlock(getSubTree({ parentUid: pageUid, key: "editing" }).uid);
    },
    [pageUid],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const onRefresh = useCallback(
    (loadInBackground = false) => {
      setError("");
      setLoading(!loadInBackground);
      const args = parseQuery(pageUid);
      setTimeout(() => {
        fireQuery(args)
          .then((results) => {
            setColumns(args.columns);
            setResults(results);
          })
          .catch(() => {
            setError(
              `Query failed to run. Try running a new query from the editor.`,
            );
          })
          .finally(() => {
            const tree = getBasicTreeByParentUid(pageUid);
            const node = getSubTree({ tree, key: "results" });
            return (
              node.uid
                ? Promise.resolve(node.uid)
                : createBlock({
                    parentUid: pageUid,
                    node: { text: "results" },
                  })
            ).then(() => {
              setLoading(false);
            });
          });
      }, 1);
    },
    [setResults, pageUid, setLoading, setColumns],
  );
  useEffect(() => {
    if (!isEdit) {
      if (hasResults) {
        onRefresh();
      } else {
        setIsEdit(true);
      }
    }
  }, [isEdit, onRefresh, setIsEdit, hasResults]);
  useEffect(() => {
    const roamBlock = containerRef.current?.closest(".rm-block-main");
    if (roamBlock) {
      const sep = roamBlock.querySelector<HTMLDivElement>(
        ".rm-block-separator",
      );
      if (sep) {
        sep.style.minWidth = "0";
      }
    }
  }, []);
  useEffect(() => {
    const main =
      containerRef.current?.closest(".rm-block-main") ||
      containerRef.current?.closest(".roamjs-query-page")?.parentElement;
    if (
      main &&
      main.nextElementSibling &&
      main.nextElementSibling.classList.contains("rm-block-children")
    ) {
      main.nextElementSibling.classList.add("roamjs-query-builder-metadata");
    }
    const container = containerRef.current?.closest<HTMLDivElement>(
      "div.roamjs-query-builder-parent",
    );
    if (container) {
      container.style.width = "unset";
    }
  }, []);
  return (
    <Card
      id={`roamjs-query-page-${pageUid}`}
      className={"roamjs-query-page overflow-auto p-0"}
    >
      <div ref={containerRef}>
        {hideMetadata && (
          <style>
            {`.roamjs-query-builder-metadata.rm-block-children {
          display: none;
        }`}
          </style>
        )}
        {isEdit && (
          <>
            <QueryEditor
              parentUid={pageUid}
              onQuery={() => {
                setHasResults(true);
                setIsEdit(false);
              }}
              setHasResults={() => {
                setHasResults(true);
                onRefresh();
              }}
              showAlias={showAlias}
            />
          </>
        )}
        {loading ? (
          <p className="px-8 py-4">
            <Spinner /> Loading Results...
          </p>
        ) : hasResults ? (
          <ResultsView
            parentUid={pageUid}
            onEdit={() => setIsEdit(true)}
            header={
              error ? (
                <div className="mb-4 text-red-700">{error}</div>
              ) : undefined
            }
            columns={columns}
            results={results.map(({ id, ...a }) => a)}
            onRefresh={onRefresh}
            isEditBlock={isEditBlock}
            onDeleteQuery={() => deleteBlock(pageUid)}
          />
        ) : (
          <></>
        )}
      </div>
    </Card>
  );
};

export const renderQueryBlock = createComponentRender(
  ({ blockUid }) => <QueryBuilder pageUid={blockUid} isEditBlock showAlias />,
  "roamjs-query-builder-parent",
);

export const renderQueryPage = ({
  title,
  h1,
  onloadArgs,
}: {
  title: string;
  h1: HTMLHeadingElement;
  onloadArgs: OnloadArgs;
}) => {
  const uid = getPageUidByPageTitle(title);
  const attribute = `data-roamjs-${uid}`;
  const containerParent = h1.parentElement?.parentElement;

  if (containerParent && !containerParent.hasAttribute(attribute)) {
    containerParent.setAttribute(attribute, "true");
    const parent = document.createElement("div");
    const configPageId = title.split("/").slice(-1)[0];
    parent.id = `${configPageId}-config`;
    containerParent.insertBefore(
      parent,
      h1.parentElement?.nextElementSibling || null,
    );

    ReactDOM.render(
      <ExtensionApiContextProvider {...onloadArgs}>
        <QueryBuilder pageUid={uid} />
      </ExtensionApiContextProvider>,
      parent,
    );
  }
};

export default QueryBuilder;
