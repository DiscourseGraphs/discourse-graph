import React, { useCallback, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  InputGroup,
  Intent,
  Spinner,
  SpinnerSize,
  Tag,
} from "@blueprintjs/core";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import {
  ADMIN_SEARCH_PROVIDER_DEFINITIONS,
  ROAM_SEMANTIC_SEARCH_RESULT_LIMIT,
  SEARCH_TEST_RESULT_LIMIT,
  runAdminSearchProvider,
  type AdminSearchProviderDefinition,
  type AdminSearchProviderId,
  type AdminSearchProviderResult,
  type AdminSearchResultItem,
} from "~/utils/discourseNodeSearchProviders";

type ResultsByProvider = Partial<
  Record<AdminSearchProviderId, AdminSearchProviderResult>
>;

type RawVisibilityByProvider = Partial<Record<AdminSearchProviderId, boolean>>;

const DEFAULT_PROVIDER_IDS = ADMIN_SEARCH_PROVIDER_DEFINITIONS.map(
  (provider) => provider.id,
);

const formatTiming = (timingMs: number): string => `${timingMs} ms`;

const formatScore = (score: number | undefined): string | null =>
  typeof score === "number" && Number.isFinite(score) ? score.toFixed(3) : null;

const getProviderDefinition = (
  providerId: AdminSearchProviderId,
): AdminSearchProviderDefinition =>
  ADMIN_SEARCH_PROVIDER_DEFINITIONS.find(
    (provider) => provider.id === providerId,
  ) || ADMIN_SEARCH_PROVIDER_DEFINITIONS[0];

const openSearchResult = async (
  result: AdminSearchResultItem,
  event: React.MouseEvent,
): Promise<void> => {
  if (!result.uid) return;

  if (event.shiftKey) {
    await window.roamAlphaAPI.ui.rightSidebar.addWindow({
      window: {
        type: "outline",
        // @ts-expect-error - block-uid is valid for outline sidebar windows.
        "block-uid": result.uid,
      },
    });
    return;
  }

  await window.roamAlphaAPI.ui.mainWindow.openPage({
    page: { uid: result.uid },
  });
};

const ResultList = ({
  emptyText,
  items,
}: {
  emptyText: string;
  items: AdminSearchResultItem[];
}): React.ReactElement => {
  if (!items.length) {
    return (
      <div className="px-2 py-4 text-sm italic text-gray-500">{emptyText}</div>
    );
  }

  return (
    <ul className="m-0 max-h-64 list-none overflow-y-auto p-0">
      {items.map((item, index) => {
        const score = formatScore(item.score);
        return (
          <li key={`${item.uid}-${index}`}>
            <Button
              alignText="left"
              fill
              minimal
              className="!h-auto !justify-start !px-2 !py-2"
              onClick={(event) => void openSearchResult(item, event)}
              text={
                <span className="flex w-full items-start gap-2">
                  {item.nodeTypeLabel && (
                    <Tag minimal className="mt-0.5 flex-shrink-0">
                      {item.nodeTypeLabel}
                    </Tag>
                  )}
                  {!item.nodeTypeLabel && item.source && (
                    <Tag minimal className="mt-0.5 flex-shrink-0">
                      {item.source}
                    </Tag>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm leading-snug text-gray-900">
                      {item.text}
                    </span>
                    {item.rawText && item.rawText !== item.text && (
                      <span className="mt-1 block truncate text-xs text-gray-500">
                        {item.rawText}
                      </span>
                    )}
                  </span>
                  {score && (
                    <span className="mt-0.5 flex-shrink-0 text-xs tabular-nums text-gray-500">
                      {score}
                    </span>
                  )}
                </span>
              }
            />
          </li>
        );
      })}
    </ul>
  );
};

const SemanticLimitSummary = ({
  result,
}: {
  result: AdminSearchProviderResult;
}): React.ReactElement => {
  const survivalRate =
    result.rawResultCount > 0
      ? Math.round((result.filteredResultCount / result.rawResultCount) * 100)
      : 0;

  return (
    <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
      .semanticSearch returned {result.rawResultCount}/
      {ROAM_SEMANTIC_SEARCH_RESULT_LIMIT} page hits.{" "}
      {result.filteredResultCount} matched discourse node page-title formats (
      {survivalRate}%).
    </div>
  );
};

const ProviderResultCard = ({
  definition,
  isRawVisible,
  onToggleRaw,
  result,
}: {
  definition: AdminSearchProviderDefinition;
  isRawVisible: boolean;
  onToggleRaw: () => void;
  result: AdminSearchProviderResult;
}): React.ReactElement => {
  const hasFilteredOverflow =
    result.filteredResultCount > result.filteredResults.length;
  const rawJson = JSON.stringify(
    {
      rawResultCount: result.rawResultCount,
      results: result.rawResults,
    },
    null,
    2,
  );

  return (
    <section className="min-w-0 rounded border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-3 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="m-0 text-sm font-semibold">{definition.title}</h4>
            <Tag minimal intent={result.error ? Intent.DANGER : Intent.PRIMARY}>
              {formatTiming(result.timingMs)}
            </Tag>
            {typeof result.candidateCount === "number" && (
              <Tag minimal>{result.candidateCount} candidates</Tag>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {definition.description}
          </div>
        </div>
        <Button
          icon={isRawVisible ? "eye-off" : "eye-open"}
          minimal
          small
          text={isRawVisible ? "Hide raw" : "Raw"}
          onClick={onToggleRaw}
        />
      </div>

      <div className="space-y-2 p-3">
        {result.error ? (
          <div className="rounded border border-red-200 bg-red-50 px-2 py-2 text-sm text-red-800">
            {result.error}
          </div>
        ) : isRawVisible ? (
          <pre className="m-0 max-h-96 overflow-auto rounded bg-gray-50 p-3 text-xs leading-snug text-gray-900">
            {rawJson}
          </pre>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <Tag minimal intent={Intent.SUCCESS}>
                {result.filteredResultCount} filtered
              </Tag>
              <Tag minimal>{result.rawResultCount} raw</Tag>
              {hasFilteredOverflow && (
                <span>Showing first {SEARCH_TEST_RESULT_LIMIT} filtered.</span>
              )}
            </div>

            {definition.id === "roamSemantic" && (
              <SemanticLimitSummary result={result} />
            )}

            {result.note && (
              <div className="text-xs leading-snug text-gray-500">
                {result.note}
              </div>
            )}

            <ResultList
              emptyText="No discourse node matches after filtering."
              items={result.filteredResults}
            />
          </>
        )}
      </div>
    </section>
  );
};

const SearchTestTab = (): React.ReactElement => {
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [selectedProviderIds, setSelectedProviderIds] =
    useState<AdminSearchProviderId[]>(DEFAULT_PROVIDER_IDS);
  const [resultsByProvider, setResultsByProvider] = useState<ResultsByProvider>(
    {},
  );
  const [rawVisibilityByProvider, setRawVisibilityByProvider] =
    useState<RawVisibilityByProvider>({});
  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedProviderIdSet = useMemo(
    () => new Set(selectedProviderIds),
    [selectedProviderIds],
  );
  const canSearch = !!query.trim() && selectedProviderIds.length > 0;

  const toggleProvider = useCallback((providerId: AdminSearchProviderId) => {
    setSelectedProviderIds((current) =>
      current.includes(providerId)
        ? current.filter((id) => id !== providerId)
        : [...current, providerId],
    );
  }, []);

  const toggleRawVisibility = useCallback(
    (providerId: AdminSearchProviderId) => {
      setRawVisibilityByProvider((current) => ({
        ...current,
        [providerId]: !current[providerId],
      }));
    },
    [],
  );

  const runSearch = useCallback(async (): Promise<void> => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || selectedProviderIds.length === 0) return;

    setIsSearching(true);
    setLastQuery(trimmedQuery);
    setResultsByProvider({});

    const nodeTypes = getDiscourseNodes();
    const providerResults = await Promise.all(
      selectedProviderIds.map((providerId) =>
        runAdminSearchProvider({
          nodeTypes,
          providerId,
          query: trimmedQuery,
        }),
      ),
    );

    const nextResults: ResultsByProvider = {};
    providerResults.forEach((result) => {
      nextResults[result.providerId] = result;
    });

    setResultsByProvider(nextResults);
    setIsSearching(false);
  }, [query, selectedProviderIds]);

  const renderWorkspace = (expanded: boolean): React.ReactElement => (
    <div
      className={`flex min-h-0 flex-col gap-3 ${expanded ? "h-full p-3" : "p-3"}`}
    >
      <div className="flex flex-none flex-wrap items-center gap-2">
        <InputGroup
          className={expanded ? "min-w-72 max-w-xl flex-1" : "min-w-64 flex-1"}
          leftIcon="search"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setQuery(event.target.value)
          }
          onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter" && canSearch && !isSearching) {
              void runSearch();
            }
          }}
          placeholder="Search discourse nodes..."
          value={query}
        />
        <Button
          icon="search"
          intent={Intent.PRIMARY}
          loading={isSearching}
          onClick={() => void runSearch()}
          disabled={!canSearch || isSearching}
          text="Search"
        />
        {!expanded && (
          <Button
            icon="fullscreen"
            minimal
            onClick={() => setIsExpanded(true)}
            text="Expand"
          />
        )}
      </div>

      <div
        className={`flex flex-none flex-wrap items-center rounded border border-gray-200 bg-gray-50 ${
          expanded ? "gap-x-3 gap-y-0.5 px-2 py-1" : "gap-x-4 gap-y-1 px-3 py-2"
        }`}
      >
        {ADMIN_SEARCH_PROVIDER_DEFINITIONS.map((provider) => (
          <Checkbox
            key={provider.id}
            checked={selectedProviderIdSet.has(provider.id)}
            className="!mb-0 whitespace-nowrap"
            label={provider.title}
            onChange={() => toggleProvider(provider.id)}
          />
        ))}
        <div className="flex-grow" />
        <Button
          minimal
          small
          text="All"
          onClick={() => setSelectedProviderIds(DEFAULT_PROVIDER_IDS)}
        />
        <Button
          minimal
          small
          text="None"
          onClick={() => setSelectedProviderIds([])}
        />
      </div>

      {lastQuery && (
        <div className="flex-none text-xs text-gray-500">
          Comparing providers for <strong>{lastQuery}</strong>
        </div>
      )}

      {isSearching && (
        <div className="flex flex-1 items-start gap-2 px-2 py-6 text-sm text-gray-600">
          <Spinner size={SpinnerSize.SMALL} />
          Searching selected providers...
        </div>
      )}

      {!isSearching && Object.keys(resultsByProvider).length > 0 && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto xl:grid-cols-2">
          {selectedProviderIds.map((providerId) => {
            const result = resultsByProvider[providerId];
            if (!result) return null;
            return (
              <ProviderResultCard
                key={providerId}
                definition={getProviderDefinition(providerId)}
                isRawVisible={!!rawVisibilityByProvider[providerId]}
                onToggleRaw={() => toggleRawVisibility(providerId)}
                result={result}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      {renderWorkspace(false)}
      <Dialog
        autoFocus={false}
        canEscapeKeyClose
        canOutsideClickClose
        className="relative flex max-h-none max-w-none flex-col overflow-hidden bg-white p-0"
        enforceFocus={false}
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        style={{
          height: "100vh",
          margin: 0,
          maxHeight: "100vh",
          maxWidth: "100vw",
          width: "100vw",
        }}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-none items-center justify-between border-b border-gray-200 px-4 py-2">
            <h3 className="m-0 text-base font-semibold">Search test</h3>
            <Button
              icon="cross"
              minimal
              onClick={() => setIsExpanded(false)}
              title="Close"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {renderWorkspace(true)}
          </div>
        </div>
      </Dialog>
    </>
  );
};

export default SearchTestTab;
