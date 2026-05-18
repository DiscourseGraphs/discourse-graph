import { useMemo } from "react";
import {
  MigrationSequence,
  TLAnyBindingUtilConstructor,
  TLAnyShapeUtilConstructor,
} from "tldraw";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import { DiscourseNodeUtil } from "./DiscourseNodeUtil";
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

/**
 * Cloudflare sync needs stable adapter arg identities, but local Roam
 * persistence currently regresses when those same refs are memoized across
 * canvas switches: the first canvas saves, later canvases stop persisting
 * block props even though drawing still works.
 *
 * Tried the cleaner design of using stable, page-scoped adapter refs for
 * both backends and resetting `useRoamStore` on `pageUid` changes. That
 * reintroduced the local multi-canvas save bug, which suggests the real issue
 * lives in `useRoamStore`'s page-switch lifecycle rather than in these arrays
 * alone.
 *
 * For now this hook intentionally splits behavior:
 * - Cloudflare gets stable, page-scoped refs.
 * - Local Roam gets fresh values so the store can rebind correctly.
 *
 * Proper fix: make `useRoamStore` explicitly page-keyed, with proven teardown
 * and re-creation of its store, timers, and pull-watch behavior on canvas
 * switches, then try moving both backends back to one stable adapter path.
 */

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
  allRelationIds,
  allAddReferencedNodeByAction,
}: {
  allNodes: DiscourseNode[];
  allRelationIds: string[];
  allAddReferencedNodeByAction: AddReferencedNodeType;
}): TLAnyShapeUtilConstructor[] => {
  return [
    DiscourseNodeUtil,
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

  const stableCustomShapeUtils = useMemo(
    () => ({
      pageUid,
      value: createShapeUtils({
        allNodes,
        allRelationIds,
        allAddReferencedNodeByAction,
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
