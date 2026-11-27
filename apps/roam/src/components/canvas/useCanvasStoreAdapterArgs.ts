import { useMemo } from "react";
import {
  MigrationSequence,
  TLAnyBindingUtilConstructor,
  TLAnyShapeUtilConstructor,
} from "tldraw";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  createLegacyDiscourseNodeShapeUtils,
  DiscourseNodeUtil,
} from "./DiscourseNodeUtil";
import {
  createAllReferencedNodeUtils,
  createAllRelationShapeUtils,
} from "./DiscourseRelationShape/DiscourseRelationUtil";
import { AddReferencedNodeType } from "./DiscourseRelationShape/DiscourseRelationTool";
import {
  createAllReferencedNodeBindings,
  createAllRelationBindings,
} from "./DiscourseRelationShape/DiscourseRelationBindings";
import { createMigrations } from "./DiscourseRelationShape/discourseRelationMigrations";

export type CanvasStoreAdapterArgs = {
  pageUid: string;
  migrations: MigrationSequence[];
  customShapeUtils: readonly TLAnyShapeUtilConstructor[];
  customBindingUtils: readonly TLAnyBindingUtilConstructor[];
  customShapeTypes: string[];
  customBindingTypes: string[];
};

const getUtilTypes = <T extends { type: string }>({
  utils,
}: {
  utils: readonly T[];
}): string[] => {
  return utils.map((u) => u.type);
};

const createShapeUtils = ({
  allNodes,
  allRelationIds,
  allAddReferencedNodeByAction,
  includeLegacyNodeTypes = false,
}: {
  allNodes: DiscourseNode[];
  allRelationIds: string[];
  allAddReferencedNodeByAction: AddReferencedNodeType;
  includeLegacyNodeTypes?: boolean;
}): TLAnyShapeUtilConstructor[] => {
  return [
    DiscourseNodeUtil,
    ...(includeLegacyNodeTypes
      ? createLegacyDiscourseNodeShapeUtils(allNodes)
      : []),
    ...createAllRelationShapeUtils(allRelationIds),
    ...createAllReferencedNodeUtils(allAddReferencedNodeByAction),
  ];
};

const createBindingUtils = ({
  allRelationIds,
  allAddReferencedNodeByAction,
}: {
  allRelationIds: string[];
  allAddReferencedNodeByAction: AddReferencedNodeType;
}): TLAnyBindingUtilConstructor[] => {
  return [
    ...createAllRelationBindings(allRelationIds),
    ...createAllReferencedNodeBindings(allAddReferencedNodeByAction),
  ];
};

export const useCanvasStoreAdapterArgs = ({
  pageUid,
  isCloudflareSync,
  allNodes,
  allRelationIds,
  allAddReferencedNodeByAction,
}: {
  pageUid: string;
  isCloudflareSync: boolean;
  allNodes: DiscourseNode[];
  allRelationIds: string[];
  allAddReferencedNodeByAction: AddReferencedNodeType;
}): CanvasStoreAdapterArgs => {
  const customShapeUtils = createShapeUtils({
    allNodes,
    allRelationIds,
    allAddReferencedNodeByAction,
  });
  const customBindingUtils = createBindingUtils({
    allRelationIds,
    allAddReferencedNodeByAction,
  });
  const customShapeTypes = getUtilTypes({
    utils: customShapeUtils,
  });
  const customBindingTypes = getUtilTypes({
    utils: customBindingUtils,
  });

  const arrowShapeMigrations = useMemo(
    () =>
      createMigrations({
        allRelationIds,
        allAddReferencedNodeActions: Object.keys(allAddReferencedNodeByAction),
        allNodeTypes: allNodes.map((node) => node.type),
      }),
    [allRelationIds, allAddReferencedNodeByAction, allNodes],
  );

  // Cloud sync subscribes by identity. Keep these schema inputs stable for each room.
  const stableCustomShapeUtils = useMemo(
    () => ({
      pageUid,
      value: createShapeUtils({
        allNodes,
        allRelationIds,
        allAddReferencedNodeByAction,
        // Cloudflare rooms may still stream pre-migration node-id shape records.
        includeLegacyNodeTypes: true,
      }),
    }),
    [pageUid, allNodes, allRelationIds, allAddReferencedNodeByAction],
  ).value;
  const stableCustomBindingUtils = useMemo(
    () => ({
      pageUid,
      value: createBindingUtils({
        allRelationIds,
        allAddReferencedNodeByAction,
      }),
    }),
    [pageUid, allRelationIds, allAddReferencedNodeByAction],
  ).value;
  const stableCustomShapeTypes = useMemo(
    () => ({
      pageUid,
      value: getUtilTypes({
        utils: stableCustomShapeUtils,
      }),
    }),
    [pageUid, stableCustomShapeUtils],
  ).value;
  const stableCustomBindingTypes = useMemo(
    () => ({
      pageUid,
      value: getUtilTypes({
        utils: stableCustomBindingUtils,
      }),
    }),
    [pageUid, stableCustomBindingUtils],
  ).value;
  const stableMigrations = useMemo(
    () => ({ pageUid, value: [arrowShapeMigrations] }),
    [pageUid, arrowShapeMigrations],
  ).value;

  return isCloudflareSync
    ? {
        pageUid,
        migrations: stableMigrations,
        customShapeUtils: stableCustomShapeUtils,
        customBindingUtils: stableCustomBindingUtils,
        customShapeTypes: stableCustomShapeTypes,
        customBindingTypes: stableCustomBindingTypes,
      }
    : {
        pageUid,
        migrations: [arrowShapeMigrations],
        customShapeUtils,
        customBindingUtils,
        customShapeTypes,
        customBindingTypes,
      };
};
