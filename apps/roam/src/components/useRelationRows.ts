import { useCallback, useEffect, useState } from "react";
import { loadRelationRows, type RelationRow } from "./relationsPageData";

export const useRelationRows = ({
  pageUid,
  onRowsLoaded,
}: {
  pageUid: string;
  onRowsLoaded: (uids: string[] | null) => void;
}): {
  rows: RelationRow[];
  loading: boolean;
  error: boolean;
  refresh: () => void;
} => {
  const [rows, setRows] = useState<RelationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const endpointUids = JSON.stringify(
    [...new Set(rows.flatMap((row) => [row.source.uid, row.destination.uid]))]
      .filter(Boolean)
      .sort(),
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const changed = (): void => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    };
    const pattern = "[:block/uid :node/title :block/string]";
    const entities = (JSON.parse(endpointUids) as string[]).map(
      (uid) => `[:block/uid ${JSON.stringify(uid)}]`,
    );
    entities.forEach((entity) =>
      window.roamAlphaAPI.data.addPullWatch(pattern, entity, changed),
    );
    return () => {
      clearTimeout(timer);
      entities.forEach((entity) =>
        window.roamAlphaAPI.data.removePullWatch(pattern, entity, changed),
      );
    };
  }, [endpointUids, pageUid, refresh]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const changed = (): void => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    };
    const pattern =
      "[:block/uid {:block/children [:block/uid :block/props :create/time]}]";
    const entity = `[:block/uid "${pageUid}"]`;
    window.roamAlphaAPI.data.addPullWatch(pattern, entity, changed);
    return () => {
      clearTimeout(timer);
      window.roamAlphaAPI.data.removePullWatch(pattern, entity, changed);
    };
  }, [pageUid, refresh]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadRelationRows(pageUid)
      .then((nextRows) => {
        if (!active) return;
        setRows(nextRows);
        setError(false);
        onRowsLoaded(nextRows.map((row) => row.uid));
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(true);
        onRowsLoaded(null);
        console.error("Could not load the relations page.", cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pageUid, version, onRowsLoaded]);

  return { rows, loading, error, refresh };
};
