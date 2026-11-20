import { isJsonObject, normalizeProps, type json } from "~/utils/getBlockProps";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import getDiscourseNodes from "~/utils/getDiscourseNodes";

export const UNKNOWN_RELATION_FILTER = "__unknown__";
export type RelationFilters = {
  type: string;
  nodeType: string;
  status: "" | "tentative" | "confirmed";
};
export const EMPTY_RELATION_FILTERS: RelationFilters = {
  type: "",
  nodeType: "",
  status: "",
};

export type RelationEndpoint = {
  uid: string;
  text: string;
  isPage: boolean;
  exists: boolean;
  typeId: string;
  typeLabel: string;
};
export type RelationRow = {
  uid: string;
  type: string;
  schemaUid: string;
  typeKnown: boolean;
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
  const relations = records.flatMap(([uid, props, createdAt]) => {
    const normalized = normalizeProps(props);
    const relation = isJsonObject(normalized)
      ? normalized["discourse-graph"]
      : undefined;
    return isJsonObject(relation) ? [{ uid, props, createdAt, relation }] : [];
  });
  const endpointUids = [
    ...new Set(
      relations
        .flatMap(({ relation }) => [
          relation.sourceUid,
          relation.destinationUid,
        ])
        .filter(
          (uid): uid is string => typeof uid === "string" && uid.length > 0,
        ),
    ),
  ];
  // Async Datalog pull results use unnamespaced keys, unlike roamAlphaAPI.pull.
  const endpointRecords = endpointUids.length
    ? ((await window.roamAlphaAPI.data.async.q(
        `[:find (pull ?node [:block/uid :node/title :block/string])
          :in $ [?uid ...] :where [?node :block/uid ?uid]]`,
        endpointUids,
      )) as [
        {
          uid: string;
          title?: string;
          string?: string;
        },
      ][])
    : [];
  const nodes = new Map(endpointRecords.map(([node]) => [node.uid, node]));
  const schemas = new Map(getDiscourseRelations().map((r) => [r.id, r]));
  const nodeTypes = new Map(
    getDiscourseNodes().map((node) => [node.type, node.text]),
  );
  nodeTypes.set("*", "Any");
  const getEndpoint = ({
    value,
    typeId,
  }: {
    value: json | undefined;
    typeId?: string;
  }): RelationEndpoint => {
    const uid = typeof value === "string" ? value : "";
    const node = nodes.get(uid);
    // A stored relation's schema defines the node types of its two roles.
    const knownType = typeId && nodeTypes.has(typeId) ? typeId : "";
    return {
      uid,
      text:
        node?.title ||
        node?.string ||
        (node ? "Untitled block" : "Missing node"),
      isPage: typeof node?.title === "string",
      exists: Boolean(node),
      typeId: knownType,
      typeLabel: nodeTypes.get(knownType) || "Unknown type",
    };
  };
  return relations.map(({ uid, props, createdAt, relation }) => {
    const schemaUid =
      typeof relation.hasSchema === "string" ? relation.hasSchema : "";
    const schema = schemas.get(schemaUid);
    return {
      uid,
      props,
      schemaUid,
      type: schema?.label || "Unknown type",
      typeKnown: Boolean(schema),
      source: getEndpoint({
        value: relation.sourceUid,
        typeId: schema?.source,
      }),
      destination: getEndpoint({
        value: relation.destinationUid,
        typeId: schema?.destination,
      }),
      tentative: relation.tentative === "true",
      createdAt:
        typeof createdAt === "number" &&
        createdAt >= 0 &&
        Number.isFinite(new Date(createdAt).getTime())
          ? createdAt
          : null,
    };
  });
};

export const selectRelationRows = ({
  rows,
  type,
  search,
  sort,
  descending,
  nodeType = "",
  status = "",
}: {
  rows: RelationRow[];
  type: string;
  search: string;
  sort: RelationSort;
  descending: boolean;
  nodeType?: string;
  status?: RelationFilters["status"];
}): RelationRow[] => {
  const query = search.trim().toLocaleLowerCase();
  const label = (row: RelationRow): string =>
    sort === "source" || sort === "destination" ? row[sort].text : row.type;
  return rows
    .filter(
      (row) =>
        (!status || row.tentative === (status === "tentative")) &&
        (!type ||
          (type === UNKNOWN_RELATION_FILTER
            ? !row.typeKnown
            : row.schemaUid === type)) &&
        (!nodeType ||
          [row.source, row.destination].some(
            (endpoint) =>
              (endpoint.typeId || UNKNOWN_RELATION_FILTER) === nodeType,
          )) &&
        [
          row.type,
          row.source.text,
          row.destination.text,
          row.source.typeLabel,
          row.destination.typeLabel,
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

export const getRelationFilterOptions = (
  rows: RelationRow[],
): Record<keyof RelationFilters, { value: string; label: string }[]> => {
  const counts = {
    type: new Map<string, { label: string; count: number }>(),
    nodeType: new Map<string, { label: string; count: number }>(),
    status: new Map([
      ["tentative", { label: "Tentative", count: 0 }],
      ["confirmed", { label: "Confirmed", count: 0 }],
    ]),
  };
  rows.forEach((row) => {
    const values = {
      status: [
        {
          id: row.tentative ? "tentative" : "confirmed",
          label: row.tentative ? "Tentative" : "Confirmed",
        },
      ],
      type: [{ id: row.typeKnown ? row.schemaUid : "", label: row.type }],
      nodeType: [row.source, row.destination].map((endpoint) => ({
        id: endpoint.typeId,
        label: endpoint.typeLabel,
      })),
    };
    (Object.keys(values) as (keyof RelationFilters)[]).forEach((key) => {
      // Count relations once even when both endpoints have the same node type.
      new Map(
        values[key].map(({ id, label }) => [
          id || UNKNOWN_RELATION_FILTER,
          label,
        ]),
      ).forEach((label, value) => {
        const previous = counts[key].get(value);
        counts[key].set(value, { label, count: (previous?.count || 0) + 1 });
      });
    });
  });
  const options = (
    key: keyof RelationFilters,
  ): { value: string; label: string }[] =>
    [...counts[key]]
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([value, { label, count }]) => ({
        value,
        label: `${label} (${count})`,
      }));
  return {
    type: options("type"),
    nodeType: options("nodeType"),
    status: options("status"),
  };
};
