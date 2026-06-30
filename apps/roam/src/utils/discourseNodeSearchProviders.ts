import MiniSearch from "minisearch";
import fuzzy from "fuzzy";
import { nextApiRoot } from "@repo/utils/execContext";
import { getLoggedInClient } from "~/utils/supabaseContext";
import type { Result } from "~/utils/types";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import { getAllDiscourseNodesSince } from "~/utils/getAllDiscourseNodesSince";
import {
  DISCOURSE_NODE_MIN_SEARCH_SCORE,
  DISCOURSE_NODE_MINI_SEARCH_OPTIONS,
  getPulledDiscourseNodeTitle,
  getPulledDiscourseNodeUid,
  queryDiscourseNodesByFormatSync,
} from "~/utils/discourseNodeSearch";

export const ROAM_SEMANTIC_SEARCH_RESULT_LIMIT = 200;
export const SEARCH_TEST_RESULT_LIMIT = 100;
const SUPABASE_MATCH_THRESHOLD = 0;

export type AdminSearchProviderId =
  | "roamSemantic"
  | "miniSearch"
  | "roamFuzzy"
  | "supabaseSemantic";

export type AdminSearchProviderDefinition = {
  id: AdminSearchProviderId;
  title: string;
  description: string;
};

export const ADMIN_SEARCH_PROVIDER_DEFINITIONS: AdminSearchProviderDefinition[] =
  [
    {
      id: "roamSemantic",
      title: "Roam semantic",
      description: "Roam Alpha API .semanticSearch page hits.",
    },
    {
      id: "miniSearch",
      title: "MiniSearch",
      description: "Existing discourse node search index and scoring.",
    },
    {
      id: "roamFuzzy",
      title: "Fuzzy",
      description: "npm fuzzy package over locally gathered discourse nodes.",
    },
    {
      id: "supabaseSemantic",
      title: "Supabase semantic",
      description: "Synced content embeddings from suggestive mode.",
    },
  ];

export type AdminSearchResultItem = {
  uid: string;
  text: string;
  type?: string;
  nodeTypeLabel?: string;
  score?: number;
  rawText?: string;
  source?: string;
};

export type AdminSearchProviderResult = {
  providerId: AdminSearchProviderId;
  rawResults: AdminSearchResultItem[];
  rawResultCount: number;
  filteredResults: AdminSearchResultItem[];
  filteredResultCount: number;
  timingMs: number;
  candidateCount?: number;
  error?: string;
  note?: string;
};

type DiscourseNodeFormatMatcher = {
  node: DiscourseNode;
  regex: RegExp;
};

type RoamSemanticSearchHit = {
  uid?: string;
  type?: "chunk" | "block" | "page";
  text?: string;
  title?: string;
  string?: string;
  content?: string;
  score?: number;
};

type PulledRoamPage = {
  ":block/uid"?: string;
  ":node/title"?: string;
};

type EmbeddingApiResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

type SupabaseEmbeddingMatch = {
  roam_uid: string;
  text_content: string;
  similarity: number;
};

type MiniSearchDocument = AdminSearchResultItem & {
  id: string;
  type: string;
  nodeTypeLabel: string;
};

type AdminSearchRunArgs = {
  nodeTypes: DiscourseNode[];
  providerId: AdminSearchProviderId;
  query: string;
};

type AdminSearchProviderPayload = Omit<
  AdminSearchProviderResult,
  "providerId" | "timingMs"
>;

const now = (): number =>
  typeof performance === "undefined" ? Date.now() : performance.now();

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isSearchableDiscourseNode = (node: DiscourseNode): boolean =>
  node.backedBy === "user" && !!node.format?.trim();

export const getDiscourseNodeFormatMatchers = (
  nodeTypes: DiscourseNode[],
): DiscourseNodeFormatMatcher[] =>
  nodeTypes.filter(isSearchableDiscourseNode).map((node) => ({
    node,
    regex: getDiscourseNodeFormatExpression(node.format),
  }));

export const getMatchingDiscourseNodeType = ({
  matchers,
  title,
}: {
  matchers: DiscourseNodeFormatMatcher[];
  title: string;
}): DiscourseNode | undefined =>
  matchers.find(({ regex }) => regex.test(title))?.node;

const toResultItem = ({
  nodeType,
  rawText,
  score,
  source,
  text,
  uid,
}: {
  nodeType?: DiscourseNode;
  rawText?: string;
  score?: number;
  source?: string;
  text: string;
  uid: string;
}): AdminSearchResultItem => ({
  uid,
  text,
  type: nodeType?.type,
  nodeTypeLabel: nodeType?.text,
  score,
  rawText,
  source,
});

const filterResultsToDiscourseNodeTitles = ({
  matchers,
  results,
}: {
  matchers: DiscourseNodeFormatMatcher[];
  results: AdminSearchResultItem[];
}): AdminSearchResultItem[] =>
  results.reduce<AdminSearchResultItem[]>((acc, result) => {
    const nodeType = getMatchingDiscourseNodeType({
      matchers,
      title: result.text,
    });
    if (!nodeType) return acc;

    acc.push({
      ...result,
      type: result.type || nodeType.type,
      nodeTypeLabel: result.nodeTypeLabel || nodeType.text,
    });
    return acc;
  }, []);

const pullPageTitlesByUid = async (
  uids: string[],
): Promise<Record<string, string>> => {
  const uniqueUids = Array.from(new Set(uids.filter(Boolean)));
  if (!uniqueUids.length) return {};

  const pulledPages = (await window.roamAlphaAPI.data.async.pull_many(
    "[:node/title :block/uid]",
    uniqueUids.map((uid) => [":block/uid", uid]),
  )) as PulledRoamPage[];

  return pulledPages.reduce(
    (acc, page, index) => {
      if (!page) return acc;
      const uid = page[":block/uid"] || uniqueUids[index];
      const title = page[":node/title"];
      if (uid && title) acc[uid] = title;
      return acc;
    },
    {} as Record<string, string>,
  );
};

export const searchSemanticNodeTitles = async ({
  k = ROAM_SEMANTIC_SEARCH_RESULT_LIMIT,
  nodeTypes,
  query,
}: {
  k?: number;
  nodeTypes: DiscourseNode[];
  query: string;
}): Promise<Result[]> => {
  const providerResult = await runRoamSemanticSearch({
    nodeTypes,
    query,
  }).catch(() => ({
    rawResults: [],
    rawResultCount: 0,
    filteredResults: [],
    filteredResultCount: 0,
  }));

  return providerResult.filteredResults.slice(0, k).map(
    (result) =>
      ({
        text: result.text,
        uid: result.uid,
        discourseNodeType: result.type,
      }) as Result,
  );
};

const runRoamSemanticSearch = async ({
  nodeTypes,
  query,
}: {
  nodeTypes: DiscourseNode[];
  query: string;
}): Promise<AdminSearchProviderPayload> => {
  const trimmedQuery = query.trim();
  const matchers = getDiscourseNodeFormatMatchers(nodeTypes);
  if (!trimmedQuery || !matchers.length) {
    return {
      rawResults: [],
      rawResultCount: 0,
      filteredResults: [],
      filteredResultCount: 0,
    };
  }

  if (!window.roamAlphaAPI.data.semanticSearchEnabled()) {
    throw new Error("Roam semantic search is not enabled.");
  }

  const hits = (await window.roamAlphaAPI.data.async.semanticSearch({
    "search-str": trimmedQuery,
    "hide-code-blocks": false,
    "search-blocks": false,
    "search-pages": true,
    k: ROAM_SEMANTIC_SEARCH_RESULT_LIMIT,
  })) as RoamSemanticSearchHit[];
  const pageHits = hits.filter((hit) => hit.type === "page");

  const titlesByUid = await pullPageTitlesByUid(
    pageHits.map((hit) => hit.uid || ""),
  );

  const rawResults = pageHits.map((hit, index) => {
    const uid = hit.uid || "";
    const title = uid ? titlesByUid[uid] : undefined;
    return toResultItem({
      uid,
      text:
        title ||
        hit.title ||
        hit.text ||
        hit.string ||
        hit.content ||
        (uid ? `Untitled hit ${uid}` : `Untitled hit ${index + 1}`),
      score: hit.score,
      source: hit.type || "unknown",
    });
  });

  const filteredResults = filterResultsToDiscourseNodeTitles({
    matchers,
    results: rawResults,
  });

  return {
    rawResults,
    rawResultCount: pageHits.length,
    filteredResults,
    filteredResultCount: filteredResults.length,
    note:
      `.semanticSearch returned ${pageHits.length}/${ROAM_SEMANTIC_SEARCH_RESULT_LIMIT} page hits; ` +
      `${hits.length - pageHits.length} non-page hits were discarded; ` +
      `${filteredResults.length} matched discourse node page-title formats.`,
  };
};

const getNodeSearchDocuments = (
  nodeTypes: DiscourseNode[],
): MiniSearchDocument[] => {
  const documents: MiniSearchDocument[] = [];
  const seenUids = new Set<string>();

  nodeTypes.filter(isSearchableDiscourseNode).forEach((node) => {
    queryDiscourseNodesByFormatSync({ node }).forEach((pulledNode) => {
      const uid = getPulledDiscourseNodeUid(pulledNode);
      const text = getPulledDiscourseNodeTitle(pulledNode);
      if (!uid || !text || seenUids.has(uid)) return;
      seenUids.add(uid);
      documents.push({
        id: uid,
        uid,
        text,
        type: node.type,
        nodeTypeLabel: node.text,
      });
    });
  });

  return documents;
};

const miniSearchHitToResult = (
  hit: MiniSearchDocument & { score: number },
): AdminSearchResultItem => ({
  uid: hit.uid,
  text: hit.text,
  type: hit.type,
  nodeTypeLabel: hit.nodeTypeLabel,
  score: hit.score,
});

const runMiniSearch = ({
  nodeTypes,
  query,
}: {
  nodeTypes: DiscourseNode[];
  query: string;
}): AdminSearchProviderPayload => {
  const trimmedQuery = query.trim();
  const documents = getNodeSearchDocuments(nodeTypes);
  if (!trimmedQuery || !documents.length) {
    return {
      rawResults: [],
      rawResultCount: 0,
      filteredResults: [],
      filteredResultCount: 0,
      candidateCount: documents.length,
    };
  }

  const miniSearch = new MiniSearch<MiniSearchDocument>({
    fields: ["text", "nodeTypeLabel"],
    storeFields: ["uid", "text", "type", "nodeTypeLabel"],
    idField: "id",
  });
  miniSearch.addAll(documents);

  const rawHits = miniSearch.search(trimmedQuery, {
    fields: ["text"],
    ...DISCOURSE_NODE_MINI_SEARCH_OPTIONS,
  }) as unknown as Array<MiniSearchDocument & { score: number }>;

  const filteredHits = rawHits.filter(
    (hit) => hit.score > DISCOURSE_NODE_MIN_SEARCH_SCORE,
  );

  return {
    rawResults: rawHits
      .slice(0, SEARCH_TEST_RESULT_LIMIT)
      .map(miniSearchHitToResult),
    rawResultCount: rawHits.length,
    filteredResults: filteredHits
      .slice(0, SEARCH_TEST_RESULT_LIMIT)
      .map(miniSearchHitToResult),
    filteredResultCount: filteredHits.length,
    candidateCount: documents.length,
    note: `${documents.length} discourse node pages indexed; filtered by MiniSearch score > ${DISCOURSE_NODE_MIN_SEARCH_SCORE}.`,
  };
};

const getFuzzyCandidates = async (
  nodeTypes: DiscourseNode[],
): Promise<AdminSearchResultItem[]> => {
  const matchers = getDiscourseNodeFormatMatchers(nodeTypes);
  const nodes = await getAllDiscourseNodesSince(
    undefined,
    nodeTypes.filter(isSearchableDiscourseNode),
  );
  const seenUids = new Set<string>();

  return nodes
    .map((node) => {
      const uid = node.source_local_id;
      const title = node.node_title || node.text;
      if (!uid || !title || seenUids.has(uid)) return null;
      const nodeType = getMatchingDiscourseNodeType({
        matchers,
        title,
      });
      if (!nodeType) return null;
      seenUids.add(uid);
      return toResultItem({
        uid,
        text: title,
        rawText: node.node_title ? node.text : undefined,
        nodeType,
      });
    })
    .filter((result): result is AdminSearchResultItem => !!result);
};

const runRoamFuzzySearch = async ({
  nodeTypes,
  query,
}: {
  nodeTypes: DiscourseNode[];
  query: string;
}): Promise<AdminSearchProviderPayload> => {
  const trimmedQuery = query.trim();
  const candidates = await getFuzzyCandidates(nodeTypes);
  if (!trimmedQuery || !candidates.length) {
    return {
      rawResults: candidates.slice(0, SEARCH_TEST_RESULT_LIMIT),
      rawResultCount: candidates.length,
      filteredResults: [],
      filteredResultCount: 0,
      candidateCount: candidates.length,
    };
  }

  const matches = fuzzy
    .filter(trimmedQuery, candidates, {
      extract: (item) => item.text,
    })
    .map((match) => match.original);

  return {
    rawResults: candidates.slice(0, SEARCH_TEST_RESULT_LIMIT),
    rawResultCount: candidates.length,
    filteredResults: matches.slice(0, SEARCH_TEST_RESULT_LIMIT),
    filteredResultCount: matches.length,
    candidateCount: candidates.length,
    note: `${candidates.length} pages matched discourse node title formats before fuzzy filtering.`,
  };
};

const createEmbedding = async (text: string): Promise<number[]> => {
  const response = await fetch(`${nextApiRoot()}/embeddings/openai/small`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: text }),
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed with ${response.status}.`);
  }

  const data = (await response.json()) as EmbeddingApiResponse;
  const embedding = data.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error("Embedding response did not include a vector.");
  }

  return embedding;
};

const runSupabaseSemanticSearch = async ({
  nodeTypes,
  query,
}: {
  nodeTypes: DiscourseNode[];
  query: string;
}): Promise<AdminSearchProviderPayload> => {
  const trimmedQuery = query.trim();
  const matchers = getDiscourseNodeFormatMatchers(nodeTypes);
  if (!trimmedQuery || !matchers.length) {
    return {
      rawResults: [],
      rawResultCount: 0,
      filteredResults: [],
      filteredResultCount: 0,
    };
  }

  const supabase = await getLoggedInClient();
  if (!supabase) {
    throw new Error("Could not connect to Supabase.");
  }

  const queryEmbedding = await createEmbedding(trimmedQuery);
  const { data, error } = await supabase
    .rpc("match_content_embeddings", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: SUPABASE_MATCH_THRESHOLD,
    })
    .limit(SEARCH_TEST_RESULT_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  const matches = Array.isArray(data) ? (data as SupabaseEmbeddingMatch[]) : [];
  const titlesByUid = await pullPageTitlesByUid(
    matches.map((match) => match.roam_uid),
  );
  const rawResults = matches.map((match) => {
    const title = titlesByUid[match.roam_uid];
    return toResultItem({
      uid: match.roam_uid,
      text: title || match.text_content || match.roam_uid,
      rawText: match.text_content,
      score: match.similarity,
    });
  });
  const filteredResults = filterResultsToDiscourseNodeTitles({
    matchers,
    results: rawResults,
  });

  return {
    rawResults,
    rawResultCount: matches.length,
    filteredResults,
    filteredResultCount: filteredResults.length,
    note: `${matches.length} embedding matches returned; ${filteredResults.length} matched current Roam discourse node page-title formats.`,
  };
};

export const runAdminSearchProvider = async ({
  nodeTypes,
  providerId,
  query,
}: AdminSearchRunArgs): Promise<AdminSearchProviderResult> => {
  const start = now();

  try {
    const payload =
      providerId === "roamSemantic"
        ? await runRoamSemanticSearch({ nodeTypes, query })
        : providerId === "miniSearch"
          ? runMiniSearch({ nodeTypes, query })
          : providerId === "roamFuzzy"
            ? await runRoamFuzzySearch({ nodeTypes, query })
            : await runSupabaseSemanticSearch({ nodeTypes, query });

    return {
      ...payload,
      providerId,
      timingMs: Math.round(now() - start),
    };
  } catch (error) {
    return {
      providerId,
      rawResults: [],
      rawResultCount: 0,
      filteredResults: [],
      filteredResultCount: 0,
      timingMs: Math.round(now() - start),
      error: getErrorMessage(error),
    };
  }
};
