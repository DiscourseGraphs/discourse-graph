import React, { useState, useMemo } from "react";
import {
  Dialog,
  Classes,
  Label,
  Button,
  Icon,
  Callout,
} from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { render as renderToast } from "roamjs-components/components/Toast";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { getSetting } from "~/utils/extensionSettings";
import getDiscourseRelations, {
  type DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import { createReifiedRelation } from "~/utils/createReifiedBlock";
import findDiscourseNode from "~/utils/findDiscourseNode";
import { getDiscourseNodeFormatInnerExpression } from "~/utils/getDiscourseNodeFormatExpression";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import type { Result } from "~/utils/types";
import internalError from "~/utils/internalError";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import { USE_REIFIED_RELATIONS } from "~/data/userSettings";
import posthog from "posthog-js";

export type CreateRelationDialogProps = {
  onClose: () => void;
  sourceNodeUid: string;
};

type RelWithDirection = DiscourseRelation & {
  forward: boolean;
};

type ExtendedCreateRelationDialogProps = CreateRelationDialogProps & {
  relData: RelWithDirection[];
  sourceNodeTitle: string;
  selectedSourceType: DiscourseNode;
};

const CreateRelationDialog = ({
  onClose,
  sourceNodeUid,
  relData,
  sourceNodeTitle,
  selectedSourceType,
}: ExtendedCreateRelationDialogProps) => {
  const discourseNodes = useMemo(() => getDiscourseNodes(), []);
  const nodesById = Object.fromEntries(discourseNodes.map((n) => [n.type, n]));
  const relDataByTag = useMemo(() => {
    const byTag: Record<string, RelWithDirection[]> = {};
    for (const rel of relData) {
      const useLabel = rel.forward ? rel.label : rel.complement;
      if (byTag[useLabel] === undefined) byTag[useLabel] = [rel];
      else byTag[useLabel].push(rel);
    }
    return byTag;
  }, [relData]);

  const relKeys = Object.keys(relDataByTag);
  const [selectedRelationName, setSelectedRelationName] = useState(relKeys[0]);
  const [selectedTarget, setSelectedTarget] = useState<Result>({
    text: "",
    uid: "",
  });
  const pageUidByTitle = useMemo(
    () =>
      Object.fromEntries(
        window.roamAlphaAPI.data.fast.q(
          "[:find ?t ?u :where [?p :node/title ?t] [?p :block/uid ?u]]",
        ) as [string, string][],
      ),
    [],
  );
  const allPages = useMemo(
    () =>
      Object.entries(pageUidByTitle).map(
        ([text, uid]): Result => ({ uid, text }),
      ),
    [pageUidByTitle],
  );
  const getFilteredPageNames = (selectedRelationName: string): Result[] => {
    if (!relDataByTag[selectedRelationName]?.length) return [];
    const formats = relDataByTag[selectedRelationName].map((rel) =>
      getDiscourseNodeFormatInnerExpression(
        nodesById[rel.forward ? rel.destination : rel.source].format,
      ),
    );
    const re = RegExp(`^(${formats.join(")|(")})$`, "s");
    return allPages.filter(({ text }) => text.match(re));
  };
  const [pageOptions, setPageOptions] = useState<Result[]>(
    getFilteredPageNames(relKeys[0]),
  );

  const identifyRelationMatch = (target: Result): RelWithDirection | null => {
    if (target.text.length === 0) return null;
    const selectedTargetType = findDiscourseNode({
      uid: target.uid,
      title: target.text,
      nodes: discourseNodes,
    });
    if (selectedTargetType === false) {
      // should not happen at this point, since the pattern was vetted at input.
      internalError({
        type: "Create Relation dialog",
        error: "Could not identify node downstream",
      });
      return null;
    }
    const candidateRelations = relDataByTag[selectedRelationName].filter(
      (rel) => {
        if (rel.forward) {
          return (
            rel.source === selectedSourceType.type &&
            rel.destination === selectedTargetType.type
          );
        } else {
          return (
            rel.source === selectedTargetType.type &&
            rel.destination === selectedSourceType.type
          );
        }
      },
    );
    if (candidateRelations.length === 0) {
      // also should not happen
      internalError({
        type: "Create Relation dialog",
        error: "Could not find the relation",
      });
      return null;
    }
    if (candidateRelations.length > 1) {
      // Control for one very innocuous case: Many times the same relation, with different triples.
      const setOfRels = new Set(
        candidateRelations.map((r) => (r.forward ? r.id : `-${r.id}`)),
      );
      if (setOfRels.size > 1) {
        internalError({
          type: "Create Relation dialog",
          error: `Too many relations between ${selectedTargetType.type} and ${selectedSourceType.type}: ${[...setOfRels].join(",")}`,
        });
        // let it still fall through to the first
      }
    }
    return candidateRelations[0];
  };

  const onCreate = async (): Promise<boolean> => {
    if (selectedTarget.uid === "") return false;
    const relation = identifyRelationMatch(selectedTarget);
    if (relation === null) return false;
    const result = await createReifiedRelation({
      relationBlockUid: relation.id,
      sourceUid: relation.forward ? sourceNodeUid : selectedTarget.uid,
      destinationUid: relation.forward ? selectedTarget.uid : sourceNodeUid,
    });
    return result !== undefined;
  };

  const onCreateSync = (): void => {
    posthog.capture("Create Relation Dialog: Create Triggered", {
      relationName: selectedRelationName,
      hasTarget: !!selectedTarget.uid,
    });
    onCreate()
      .then((result: boolean) => {
        if (result) {
          renderToast({
            id: `discourse-relation-created-${Date.now()}`,
            intent: "success",
            timeout: 10000,
            content: <span>Created relation</span>,
          });
        } else {
          renderToast({
            id: `discourse-relation-error-${Date.now()}`,
            intent: "warning",
            content: <span>Failed to create relation</span>,
          });
        }
        onClose();
      })
      .catch(() => {
        renderToast({
          id: `discourse-relation-error-${Date.now()}`,
          intent: "danger",
          content: <span>Failed to create relation</span>,
        });
        onClose();
      });
  };

  const changeRelationType = (relName: string): void => {
    setSelectedRelationName(relName);
    setPageOptions(getFilteredPageNames(relName));
    if (
      selectedTarget.uid !== "" &&
      identifyRelationMatch(selectedTarget) === null
    ) {
      setSelectedTarget({ text: "", uid: "" });
    }
  };

  const setResult = (value: Result): void => {
    const relation = value.uid.length ? identifyRelationMatch(value) : null;
    if (relation === null) {
      setSelectedTarget({ text: value.text, uid: "" });
    } else {
      setSelectedTarget(value);
    }
  };

  const setResultFromTitle = (text: string): void => {
    const uid = pageUidByTitle[text];
    if (uid === undefined) {
      setSelectedTarget({ text, uid: "" });
      return;
    }
    setResult({ text, uid });
  };

  const itemToQuery = (r?: Result) => (r ? r.text : "");

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      autoFocus={false}
      className="roamjs-canvas-dialog"
    >
      <div className={Classes.DIALOG_BODY}>
        <Callout
          intent="primary"
          className="invert-icon mb-4"
          title="Create relation"
          icon="plus"
        />
        <div className="flex flex-col gap-4">
          <div>{sourceNodeTitle}</div>

          <div>
            <Label>
              <MenuItemSelect
                items={relKeys}
                activeItem={selectedRelationName}
                onItemSelect={changeRelationType}
                className="w-full"
              />
            </Label>
          </div>
          <div className="make-popover-full-width">
            <AutocompleteInput
              value={selectedTarget}
              itemToQuery={itemToQuery}
              setValue={setResult}
              onBlur={setResultFromTitle}
              placeholder={"Search for a page..."}
              options={pageOptions}
            />
          </div>
        </div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button minimal onClick={onClose}>
            Cancel
          </Button>
          <Button
            intent="primary"
            onClick={onCreateSync}
            disabled={selectedTarget.uid === ""}
          >
            Create
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

const prepareRelData = (
  targetNodeUid: string,
  nodeTitle?: string,
): RelWithDirection[] => {
  nodeTitle = nodeTitle || getPageTitleByPageUid(targetNodeUid).trim();
  const discourseNodeSchemas = getDiscourseNodes();
  const relations = getDiscourseRelations();
  const nodeSchema = findDiscourseNode({
    uid: targetNodeUid,
    title: nodeTitle,
    nodes: discourseNodeSchemas,
  });
  if (!nodeSchema) {
    // should not happen at this point, since the pattern was vetted at input.
    internalError({
      error: "Could not identify node downstream",
      type: "Create Relation dialog",
    });
    return [];
  }
  // note the same relation could be used in both directions
  const availableForwardRelations = relations.filter(
    (rel) => rel.source === nodeSchema.type,
  );
  const availableReverseRelations = relations.filter(
    (rel) => rel.destination === nodeSchema.type,
  );
  const availableRelations: RelWithDirection[] = [
    ...availableForwardRelations.map((rel) => ({
      ...rel,
      forward: true,
    })),
    ...availableReverseRelations.map((rel) => ({
      ...rel,
      forward: false,
    })),
  ];
  return availableRelations;
};

const extendProps = ({
  sourceNodeUid,
  onClose,
}: CreateRelationDialogProps): ExtendedCreateRelationDialogProps | null => {
  const nodeTitle = getPageTitleByPageUid(sourceNodeUid).trim();
  const relData = prepareRelData(sourceNodeUid, nodeTitle);
  const selectedSourceType = findDiscourseNode({
    uid: sourceNodeUid,
    title: nodeTitle,
  });
  if (selectedSourceType === false) {
    // should not happen
    throw new Error("Could not identify type of node");
  }
  if (relData.length === 0) {
    return null;
  }
  return {
    sourceNodeUid,
    onClose,
    relData,
    sourceNodeTitle: nodeTitle,
    selectedSourceType,
  };
};

export const renderCreateRelationDialog = (
  props: CreateRelationDialogProps | ExtendedCreateRelationDialogProps | null,
): void => {
  if (props === null) return;
  const { sourceNodeUid } = props;
  if ((props as ExtendedCreateRelationDialogProps).relData === undefined) {
    try {
      props = extendProps(props);
    } catch (e) {
      renderToast({
        id: `discourse-relation-error-${Date.now()}`,
        intent: "danger",
        content: <span>{(e as Error).message}</span>,
      });
      return;
    }
  }
  if (props === null) {
    renderToast({
      id: `discourse-relation-error-${Date.now()}`,
      intent: "warning",
      content: <span>No relation exists for {sourceNodeUid}</span>,
    });
  } else {
    renderOverlay({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Overlay: CreateRelationDialog,
      props: props as ExtendedCreateRelationDialogProps,
    });
  }
};

export const CreateRelationButton = (
  props: CreateRelationDialogProps,
): React.JSX.Element | null => {
  const showAddRelation = getSetting<boolean>(USE_REIFIED_RELATIONS, false);
  if (!showAddRelation) return null;
  let extProps: ExtendedCreateRelationDialogProps | null = null;
  try {
    extProps = extendProps(props);
  } catch (e) {
    // the node's type was not identified. Swallow silently.
  }
  return (
    <Button
      className="m-2"
      minimal
      disabled={extProps === null}
      onClick={() => {
        renderCreateRelationDialog(extProps);
      }}
    >
      <Icon icon="plus" />
    </Button>
  );
};
