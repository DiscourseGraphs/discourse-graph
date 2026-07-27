import assert from "node:assert/strict";
import { test } from "node:test";
import {
  groupRelationsByType,
  nodeCardContextMenuReducer,
  runRelationCanvasAction,
  shouldShowNodeCardContextMenu,
} from "../nodeCardContextMenuModel";

void test("the menu requires both the flag and a discourse-node selection", () => {
  assert.equal(shouldShowNodeCardContextMenu(false, "discourse-node"), false);
  assert.equal(shouldShowNodeCardContextMenu(true, "geo"), false);
  assert.equal(shouldShowNodeCardContextMenu(true, "discourse-node"), true);
});

void test("Context is the default tab and selecting another node resets it", () => {
  const initial = {
    activeTab: "context" as const,
    selectedShapeId: "shape:one",
  };
  const styling = nodeCardContextMenuReducer(initial, {
    type: "select-tab",
    tab: "styling",
  });

  assert.equal(styling.activeTab, "styling");
  assert.deepEqual(
    nodeCardContextMenuReducer(styling, {
      type: "select-node",
      selectedShapeId: "shape:two",
    }),
    { activeTab: "context", selectedShapeId: "shape:two" },
  );
});

void test("relations are grouped by direction and duplicate files are removed", () => {
  const files = new Map([
    ["claim", { path: "Claims/Claim.md" }],
    ["evidence", { path: "Evidence/Evidence.md" }],
  ]);
  const groups = groupRelationsByType({
    activeNodeTypeId: "question-type",
    nodeInstanceId: "question",
    relationTypes: [
      { id: "supports", label: "supports", complement: "is supported by" },
      { id: "informs", label: "informs", complement: "is informed by" },
    ],
    discourseRelations: [
      {
        sourceId: "question-type",
        destinationId: "claim-type",
        relationshipTypeId: "supports",
      },
      {
        sourceId: "evidence-type",
        destinationId: "question-type",
        relationshipTypeId: "supports",
      },
      {
        sourceId: "question-type",
        destinationId: "claim-type",
        relationshipTypeId: "informs",
      },
    ],
    relations: [
      { type: "supports", source: "question", destination: "claim" },
      { type: "supports", source: "question", destination: "claim" },
      { type: "supports", source: "evidence", destination: "question" },
    ],
    getLinkedFile: (id) => files.get(id) ?? null,
    includeAllDirections: true,
  });

  assert.deepEqual(
    groups.map(({ label, isSource, linkedFiles }) => ({
      label,
      isSource,
      paths: linkedFiles.map(({ path }) => path),
    })),
    [
      { label: "supports", isSource: true, paths: ["Claims/Claim.md"] },
      {
        label: "is supported by",
        isSource: false,
        paths: ["Evidence/Evidence.md"],
      },
      { label: "informs", isSource: true, paths: [] },
    ],
  );
});

void test("the canvas action adds an absent relation", async () => {
  let added = false;
  await runRelationCanvasAction({
    hasExistingRelation: false,
    add: () => {
      added = true;
      return Promise.resolve();
    },
    remove: () => Promise.reject(new Error("remove should not run")),
  });
  assert.equal(added, true);
});

void test("the canvas action removes an existing relation", async () => {
  let removed = false;
  await runRelationCanvasAction({
    hasExistingRelation: true,
    add: () => Promise.reject(new Error("add should not run")),
    remove: () => {
      removed = true;
      return Promise.resolve();
    },
  });
  assert.equal(removed, true);
});
