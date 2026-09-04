import React, { useCallback, useEffect, useState } from "react";
import { Button, Classes, Tag } from "@blueprintjs/core";
import { render as renderToast } from "roamjs-components/components/Toast";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import posthog from "posthog-js";
import { isRid, ridToSpaceUriAndLocalId } from "@repo/database/lib/rid";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import internalError from "~/utils/internalError";
import { getErrorMessage } from "~/utils/materializeSharedNode";
import { getStoredRelationsEnabled } from "~/utils/storedRelations";
import {
  refreshDiscourseContextsForMutatedUids,
  useDiscourseContextMutationRefresh,
} from "~/utils/discourseContextMutationRefresh";
import { acceptTentativeRelationInstance } from "~/utils/createReifiedBlock";
import {
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
  if (!importedFrom || !isRid(importedFrom.sourceNodeRid)) return "";
  const { spaceUri, sourceLocalId } = ridToSpaceUriAndLocalId(
    importedFrom.sourceNodeRid,
  );
  const modifiedAt = new Date(importedFrom.sourceModifiedAt);
  const modified = Number.isNaN(modifiedAt.getTime())
    ? undefined
    : modifiedAt.toLocaleString();
  return `from ${[spaceUri, sourceLocalId, modified].filter(Boolean).join(" · ")}`;
};

const TentativeRelationInstances = ({
  uid,
  onCountChange,
}: {
  uid: string;
  onCountChange: (count: number) => void;
}): React.JSX.Element | null => {
  const [rows, setRows] = useState<TentativeRelationRow[]>([]);
  const [pending, setPending] = useState<{
    uid: string;
    action: "accept" | "remove";
  } | null>(null);

  const loadRows = useCallback(async () => {
    if (!getStoredRelationsEnabled()) return;
    const instances = await getTentativeRelationInstances();
    const relevant = instances.filter(
      (instance) =>
        instance.sourceUid === uid || instance.destinationUid === uid,
    );
    const relationById = new Map(getDiscourseRelations().map((r) => [r.id, r]));
    const nextRows = relevant.map((instance) => {
      const isOutgoing = instance.sourceUid === uid;
      const otherUid = isOutgoing
        ? instance.destinationUid
        : instance.sourceUid;
      const schema = relationById.get(instance.schemaUid);
      const label =
        (isOutgoing ? schema?.label : schema?.complement || schema?.label) ||
        "Unknown relation";
      return {
        ...instance,
        label,
        otherText: getPageTitleByPageUid(otherUid) || otherUid,
        provenance: buildProvenance(instance.importedFrom),
      };
    });
    setRows(nextRows);
    onCountChange(nextRows.length);
  }, [uid, onCountChange]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const onMutationRefresh = useCallback(() => void loadRows(), [loadRows]);
  useDiscourseContextMutationRefresh({ uid, onMutationRefresh });

  const onAccept = async (row: TentativeRelationRow): Promise<void> => {
    posthog.capture("Discourse Context: Accept Tentative Relation Triggered", {
      instanceUid: row.instanceUid,
      uid,
    });
    setPending({ uid: row.instanceUid, action: "accept" });
    try {
      await acceptTentativeRelationInstance({ instanceUid: row.instanceUid });
      renderToast({
        id: "accept-relation-success",
        content: "Relation accepted",
        intent: "success",
      });
      refreshDiscourseContextsForMutatedUids({
        uids: [row.sourceUid, row.destinationUid],
      });
    } catch (error) {
      internalError({
        error,
        type: "Accept Tentative Relation Failed",
        context: { instanceUid: row.instanceUid },
        userMessage: `Could not accept relation: ${getErrorMessage(error)}`,
        sendEmail: false,
      });
    } finally {
      setPending(null);
    }
  };

  const onRemove = async (row: TentativeRelationRow): Promise<void> => {
    posthog.capture("Discourse Context: Remove Tentative Relation Triggered", {
      instanceUid: row.instanceUid,
      uid,
    });
    setPending({ uid: row.instanceUid, action: "remove" });
    try {
      await deleteBlock(row.instanceUid);
      renderToast({
        id: "remove-relation-success",
        content: "Relation removed",
        intent: "success",
      });
      refreshDiscourseContextsForMutatedUids({
        uids: [row.sourceUid, row.destinationUid],
      });
    } catch (error) {
      internalError({
        error,
        type: "Remove Tentative Relation Failed",
        context: { instanceUid: row.instanceUid },
        userMessage: `Could not remove relation: ${getErrorMessage(error)}`,
        sendEmail: false,
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
        <div key={row.instanceUid} className="flex items-center gap-2 py-1">
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
              pending?.uid === row.instanceUid && pending.action === "accept"
            }
            onClick={() => void onAccept(row)}
          />
          <Button
            minimal
            icon="delete"
            title="Remove relation"
            disabled={pending !== null}
            loading={
              pending?.uid === row.instanceUid && pending.action === "remove"
            }
            onClick={() => void onRemove(row)}
          />
        </div>
      ))}
    </div>
  );
};

export default TentativeRelationInstances;
