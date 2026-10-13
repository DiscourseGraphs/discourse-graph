import { isJsonObject, normalizeProps, type json } from "~/utils/getBlockProps";
import getDiscourseRelations from "~/utils/getDiscourseRelations";

export type RelationEndpoint = {
  uid: string;
  text: string;
  isPage: boolean;
  exists: boolean;
};
export type RelationRow = {
  uid: string;
  type: string;
  schemaUid: string;
  source: RelationEndpoint;
  destination: RelationEndpoint;
  tentative: boolean;
  createdAt: number | null;
  props: Record<string, json>;
};
export type RelationSort = "type" | "source" | "destination" | "createdAt";

export const loadRelationRows = async (
  pageUid: string,
): Promise<RelationRow[]> => {
  const records = (await window.roamAlphaAPI.data.async.q(
    `[:find ?uid ?props ?createdAt :in $ ?pageUid :where
      [?page :block/uid ?pageUid] [?page :block/children ?child]
      [?child :block/uid ?uid] [?child :block/props ?props]
      [(get-else $ ?child :create/time -1) ?createdAt]]`,
    pageUid,
  )) as [string, Record<string, json>, number][];
  const labels = new Map(getDiscourseRelations().map((r) => [r.id, r.label]));
  const endpoints = new Map<string, RelationEndpoint>();
  const getEndpoint = (value: json | undefined): RelationEndpoint => {
    const uid = typeof value === "string" ? value : "";
    const cached = endpoints.get(uid);
    if (cached) return cached;
    const node = uid
      ? window.roamAlphaAPI.pull("[:node/title :block/string :block/uid]", [
          ":block/uid",
          uid,
        ])
      : null;
    const endpoint = {
      uid,
      text:
        node?.[":node/title"] ||
        node?.[":block/string"] ||
        (node ? "Untitled block" : "Missing node"),
      isPage: typeof node?.[":node/title"] === "string",
      exists: Boolean(node),
    };
    endpoints.set(uid, endpoint);
    return endpoint;
  };
  return records.flatMap(([uid, props, createdAt]) => {
    const normalized = normalizeProps(props);
    const relation = isJsonObject(normalized)
      ? normalized["discourse-graph"]
      : undefined;
    if (!isJsonObject(relation)) return [];
    const schemaUid =
      typeof relation.hasSchema === "string" ? relation.hasSchema : "";
    return [
      {
        uid,
        props,
        schemaUid,
        type: labels.get(schemaUid) || "Unknown type",
        source: getEndpoint(relation.sourceUid),
        destination: getEndpoint(relation.destinationUid),
        tentative: relation.tentative === "true",
        createdAt:
          typeof createdAt === "number" &&
          createdAt >= 0 &&
          Number.isFinite(new Date(createdAt).getTime())
            ? createdAt
            : null,
      },
    ];
  });
};

export const selectRelationRows = ({
  rows,
  type,
  search,
  sort,
  descending,
}: {
  rows: RelationRow[];
  type: string;
  search: string;
  sort: RelationSort;
  descending: boolean;
}): RelationRow[] => {
  const query = search.trim().toLocaleLowerCase();
  const label = (row: RelationRow): string =>
    sort === "source" || sort === "destination" ? row[sort].text : row.type;
  return rows
    .filter(
      (row) =>
        (!type || row.schemaUid === type) &&
        [
          row.type,
          row.source.text,
          row.destination.text,
          row.uid,
          row.source.uid,
          row.destination.uid,
        ].some((value) => value.toLocaleLowerCase().includes(query)),
    )
    .sort((a, b) => {
      if (sort === "createdAt") {
        // Unknown creation times stay last in either direction.
        if (a.createdAt === null && b.createdAt !== null) return 1;
        if (b.createdAt === null && a.createdAt !== null) return -1;
        return (
          ((a.createdAt ?? 0) - (b.createdAt ?? 0) ||
            a.uid.localeCompare(b.uid)) * (descending ? -1 : 1)
        );
      }
      return (
        (label(a).localeCompare(label(b), undefined, {
          numeric: true,
          sensitivity: "base",
        }) || a.uid.localeCompare(b.uid)) * (descending ? -1 : 1)
      );
    });
};
