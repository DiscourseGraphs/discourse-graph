import React, { useCallback, useEffect, useState } from "react";
import { Button, Classes, Tag } from "@blueprintjs/core";
import { render as renderToast } from "roamjs-components/components/Toast";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { ridToSpaceUriAndLocalId } from "@repo/database/lib/rid";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import {
  refreshDiscourseContextsForMutatedUids,
  useDiscourseContextMutationRefresh,
} from "~/utils/discourseContextMutationRefresh";
import {
  acceptTentativeRelationInstance,
  getTentativeRelationInstances,
  type TentativeRelationInstance,
} from "~/utils/tentativeRelations";
import type { ImportedSourceIdentity } from "~/utils/importedSourceIdentity";

type TentativeRelationRow = TentativeRelationInstance & {
  label: string;
  otherText: string;
  provenance: string;
};

const buildProvenance = (importedFrom?: ImportedSourceIdentity): string => {
  if (!importedFrom) return "";
  const { spaceUri, sourceLocalId } = ridToSpaceUriAndLocalId(
    importedFrom.sourceNodeRid,
  );
  const sourceApp = spaceUri.startsWith("http")
    ? undefined
    : spaceUri.split(":")[0];
  const modifiedAt = new Date(importedFrom.sourceModifiedAt);
  const modified = Number.isNaN(modifiedAt.getTime())
    ? undefined
    : modifiedAt.toLocaleString();
  return [sourceApp, spaceUri, sourceLocalId, modified]
    .filter(Boolean)
    .join(" · ");
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const TentativeRelationInstances = ({
  uid,
}: {
  uid: string;
}): React.JSX.Element | null => {
  const [rows, setRows] = useState<TentativeRelationRow[]>([]);
  const [pending, setPending] = useState<{
    uid: string;
    action: "accept" | "remove";
  } | null>(null);

  const loadRows = useCallback(async () => {
    const instances = await getTentativeRelationInstances();
    const relevant = instances.filter(
      (instance) =>
        instance.sourceUid === uid || instance.destinationUid === uid,
    );
    const relationById = new Map(getDiscourseRelations().map((r) => [r.id, r]));
    setRows(
      relevant.map((instance) => {
        const isOutgoing = instance.sourceUid === uid;
        const otherUid = isOutgoing
          ? instance.destinationUid
          : instance.sourceUid;
        const schema = relationById.get(instance.schemaUid);
        const label =
          (isOutgoing ? schema?.label : schema?.complement) ||
          schema?.label ||
          "Unknown relation";
        return {
          ...instance,
          label,
          otherText: getPageTitleByPageUid(otherUid) || otherUid,
          provenance: buildProvenance(instance.importedFrom),
        };
      }),
    );
  }, [uid]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const onMutationRefresh = useCallback(() => void loadRows(), [loadRows]);
  useDiscourseContextMutationRefresh({ uid, onMutationRefresh });

  const onAccept = async (row: TentativeRelationRow): Promise<void> => {
    setPending({ uid: row.relationUid, action: "accept" });
    try {
      await acceptTentativeRelationInstance({ relationUid: row.relationUid });
      renderToast({
        id: "accept-relation-success",
        content: "Relation accepted",
        intent: "success",
      });
      refreshDiscourseContextsForMutatedUids({
        uids: [row.sourceUid, row.destinationUid],
      });
    } catch (error) {
      renderToast({
        id: "accept-relation-error",
        content: `Could not accept relation: ${toErrorMessage(error)}`,
        intent: "danger",
      });
    } finally {
      setPending(null);
    }
  };

  const onRemove = async (row: TentativeRelationRow): Promise<void> => {
    setPending({ uid: row.relationUid, action: "remove" });
    try {
      await deleteBlock(row.relationUid);
      renderToast({
        id: "remove-relation-success",
        content: "Relation removed",
        intent: "success",
      });
      refreshDiscourseContextsForMutatedUids({
        uids: [row.sourceUid, row.destinationUid],
      });
    } catch (error) {
      renderToast({
        id: "remove-relation-error",
        content: `Could not remove relation: ${toErrorMessage(error)}`,
        intent: "danger",
      });
    } finally {
      setPending(null);
    }
  };

  if (!rows.length) return null;

  return (
    <div className="roamjs-discourse-tentative-relations mt-2 px-2">
      <div className={`${Classes.TEXT_MUTED} text-xs font-semibold`}>
        Imported relations pending review ({rows.length})
      </div>
      {rows.map((row) => (
        <div key={row.relationUid} className="flex items-center gap-2 py-1">
          <div className="min-w-0 flex-1">
            <div className="truncate" title={row.otherText}>
              <Tag minimal>{row.label}</Tag> {row.otherText}
            </div>
            {row.provenance && (
              <div
                className={`${Classes.TEXT_MUTED} truncate text-xs`}
                title={row.importedFrom?.sourceNodeRid}
              >
                {row.provenance}
              </div>
            )}
          </div>
          <Button
            minimal
            icon="tick"
            title="Accept relation"
            disabled={pending !== null}
            loading={
              pending?.uid === row.relationUid && pending.action === "accept"
            }
            onClick={() => void onAccept(row)}
          />
          <Button
            minimal
            icon="delete"
            title="Remove relation"
            disabled={pending !== null}
            loading={
              pending?.uid === row.relationUid && pending.action === "remove"
            }
            onClick={() => void onRemove(row)}
          />
        </div>
      ))}
    </div>
  );
};

export default TentativeRelationInstances;
