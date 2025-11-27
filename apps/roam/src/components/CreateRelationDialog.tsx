import React, { useState, useMemo } from "react";
import { Dialog, Classes, Label, Button, Icon } from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { render as renderToast } from "roamjs-components/components/Toast";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";

import { getSetting } from "~/utils/extensionSettings";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import getDiscourseRelations, {
  type DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import { createReifiedRelation } from "~/utils/createReifiedBlock";
import {
  getDiscourseNodeTypeByTitle,
  formatToRegexpText,
} from "~/utils/getDiscourseNodeType";
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

const CreateRelationDialog = ({
  onClose,
  sourceNodeUid,
  relData,
  sourceNodeTitle,
  selectedSourceType,
}: ExtendedCreateRelationDialogProps) => {
  const discourseNodes = useMemo(() => getDiscourseNodes(), []);
  const nodesById = Object.fromEntries(discourseNodes.map((n) => [n.type, n]));
  const relDataByTag: Record<string, RelWithDirection[]> = {};
  for (const rel of relData) {
    const useLabel = rel.forward ? rel.label : rel.complement;
    if (relDataByTag[useLabel] === undefined) relDataByTag[useLabel] = [rel];
    else relDataByTag[useLabel].push(rel);
  }
  const relKeys = Object.keys(relDataByTag);
  const [selectedRelationName, setSelectedRelationName] = useState(relKeys[0]);
  const [selectedTargetTitle, setSelectedTargetTitle] = useState<string>("");
  const [selectedTargetUid, setSelectedTargetUid] = useState<
    string | undefined
  >(undefined);
  const allPages = useMemo(() => getAllPageNames().sort(), []);
  const getFilteredPageNames = (selectedRelationName: string): string[] => {
    const formats = relDataByTag[selectedRelationName].map((rel) =>
      formatToRegexpText(
        nodesById[rel.forward ? rel.destination : rel.source].format,
      ),
    );
    const re = RegExp(`^(${formats.join(")|(")})$`);
    return allPages.filter((title) => title.match(re));
  };
  const [pageOptions, setPageOptions] = useState<string[]>(
    getFilteredPageNames(relKeys[0]),
  );

  const identifyRelationMatch = (
    targetTitle: string,
  ): RelWithDirection | null => {
    if (targetTitle.length === 0) return null;
    const selectedTargetType = getDiscourseNodeTypeByTitle(
      targetTitle,
      discourseNodes,
    );
    if (selectedTargetType === null) {
      console.error("could not identify the target type");
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
      console.error("Could not find the relation");
      return null;
    }
    if (candidateRelations.length !== 1)
      console.warn("Found multiple relations");
    return candidateRelations[0];
  };

  const onCreate = async (): Promise<boolean> => {
    if (selectedTargetUid === undefined) return false;
    const relation = identifyRelationMatch(selectedTargetTitle);
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
        console.error(error);
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
      identifyRelationMatch(selectedTargetTitle) === null
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
    const relation = identifyRelationMatch(title);
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
      title="Create Discourse Relation"
      autoFocus={false}
    >
      <div className={Classes.DIALOG_BODY}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block font-bold">
              <Icon icon="plus" />
              Create relation
            </label>
          </div>
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
          <div>
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
  const nodeSchema = getDiscourseNodeTypeByTitle(
    nodeTitle,
    discourseNodeSchemas,
  );
  if (!nodeSchema) {
    console.error(
      `Could not determine the type of ${nodeTitle} (${targetNodeUid})`,
    );
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
  if (relData.length === 0) {
    console.warn(`No relation type for node ${nodeTitle}`);
    return null;
  }
  const selectedSourceType = getDiscourseNodeTypeByTitle(nodeTitle);
  if (selectedSourceType === null) return null;
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
  if ((props as ExtendedCreateRelationDialogProps).relData === undefined) {
    props = extendProps(props);
  }
  if (props === null) {
    console.error("Could not render");
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
  const extProps = extendProps(props);
  return (
    <Button
      style={{ margin: 12 }}
      disabled={extProps === null}
      onClick={
        extProps === null
          ? undefined
          : () => {
              renderCreateRelationDialog(extProps);
            }
      }
    >
      <Icon icon="plus" />
    </Button>
  );
};
