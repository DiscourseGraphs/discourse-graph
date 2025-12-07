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
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import sendErrorEmail from "~/utils/sendErrorEmail";
import { getSetting } from "~/utils/extensionSettings";
import getDiscourseRelations, {
  type DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import { createReifiedRelation } from "~/utils/createReifiedBlock";
import { findDiscourseNodeByTitleAndUid } from "~/utils/findDiscourseNode";
import { getDiscourseNodeFormatInnerExpression } from "~/utils/getDiscourseNodeFormatExpression";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import getDiscourseNodes from "~/utils/getDiscourseNodes";

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

const internalError = (msg: string) => {
  process.env.NODE_ENV === "development"
    ? console.error(msg)
    : sendErrorEmail({
        error: new Error(msg),
        type: "Create Relation Dialog Failed",
      })
        .then(() => {})
        .catch(() => {});
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
  const [selectedTargetTitle, setSelectedTargetTitle] = useState<string>("");
  const [selectedTargetUid, setSelectedTargetUid] = useState<
    string | undefined
  >(undefined);
  const allPages = useMemo(() => getAllPageNames().sort(), []);
  const getFilteredPageNames = (selectedRelationName: string): string[] => {
    const formats = relDataByTag[selectedRelationName].map((rel) =>
      getDiscourseNodeFormatInnerExpression(
        nodesById[rel.forward ? rel.destination : rel.source].format,
      ),
    );
    const re = RegExp(`^(${formats.join(")|(")})$`, "s");
    return allPages.filter((title) => title.match(re));
  };
  const [pageOptions, setPageOptions] = useState<string[]>(
    getFilteredPageNames(relKeys[0]),
  );

  const identifyRelationMatch = (
    targetTitle: string,
    targetUid: string,
  ): RelWithDirection | null => {
    if (targetTitle.length === 0) return null;
    const selectedTargetType = findDiscourseNodeByTitleAndUid({
      uid: targetUid,
      title: targetTitle,
      nodes: discourseNodes,
    });
    if (selectedTargetType === false) {
      // should not happen at this point, since the pattern was vetted at input.
      internalError("Could not find identify node downstream");
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
      internalError("Could not find the relation");
      return null;
    }
    if (candidateRelations.length !== 1) {
      // This seems to happen... I need more data.
      internalError(
        `Too many relations between ${selectedTargetType.type} and ${selectedSourceType.type}: ${candidateRelations.map((r) => r.id).join(",")}`,
      );
      return null;
    }
    return candidateRelations[0];
  };

  const onCreate = async (): Promise<boolean> => {
    if (selectedTargetUid === undefined) return false;
    const relation = identifyRelationMatch(
      selectedTargetTitle,
      selectedTargetUid,
    );
    if (relation === null) return false;
    const result = await createReifiedRelation({
      relationBlockUid: relation.id,
      sourceUid: relation.forward ? sourceNodeUid : selectedTargetUid,
      destinationUid: relation.forward ? selectedTargetUid : sourceNodeUid,
    });
    return result !== undefined;
  };

  const onCreateSync = (): void => {
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
      .catch((error) => {
        renderToast({
          id: `discourse-relation-error-${Date.now()}`,
          intent: "danger",
          content: <span>Failed to create relation</span>,
        });
        return;
      });
  };

  const changeRelationType = (relName: string): void => {
    setSelectedRelationName(relName);
    setPageOptions(getFilteredPageNames(relName));
    if (
      selectedTargetUid !== undefined &&
      identifyRelationMatch(selectedTargetTitle, selectedTargetUid) === null
    ) {
      setSelectedTargetUid(undefined);
    }
  };

  const getNodeFromTitle = (title: string): void => {
    if (title === selectedTargetTitle) return;
    setSelectedTargetTitle(title);
    const uid = getPageUidByPageTitle(title);
    if (uid.length === 0) {
      setSelectedTargetUid(undefined);
      return;
    }
    const relation = identifyRelationMatch(title, uid);
    if (relation === null) {
      setSelectedTargetUid(undefined);
      return;
    }
    setSelectedTargetUid(uid);
  };

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
              value={selectedTargetTitle}
              setValue={getNodeFromTitle}
              onBlur={getNodeFromTitle}
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
            disabled={!selectedTargetUid}
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
  const nodeSchema = findDiscourseNodeByTitleAndUid({
    uid: targetNodeUid,
    title: nodeTitle,
    nodes: discourseNodeSchemas,
  });
  if (!nodeSchema) {
    // should not happen at this point, since the pattern was vetted at input.
    internalError("Could not find identify node downstream");
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
  const selectedSourceType = findDiscourseNodeByTitleAndUid({
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
      Overlay: CreateRelationDialog,
      props: props as ExtendedCreateRelationDialogProps,
    });
  }
};

export const CreateRelationButton = (
  props: CreateRelationDialogProps,
): React.JSX.Element | null => {
  const showAddRelation = getSetting("use-reified-relations");
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
