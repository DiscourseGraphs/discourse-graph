import { describe, expect, it, vi } from "vitest";
import {
  createNodeCardContextMenuState,
  groupRelationsByType,
  nodeCardContextMenuReducer,
  runRelationCanvasAction,
  shouldShowNodeCardContextMenu,
} from "../nodeCardContextMenuModel";

describe("shouldShowNodeCardContextMenu", () => {
  it("keeps the default panel when the admin flag is off", () => {
    expect(
      shouldShowNodeCardContextMenu({
        isEnabled: false,
        selectedShapeType: "discourse-node",
      }),
    ).toBe(false);
  });

  it("keeps the default panel for regular tldraw shapes", () => {
    expect(
      shouldShowNodeCardContextMenu({
        isEnabled: true,
        selectedShapeType: "geo",
      }),
    ).toBe(false);
  });

  it("shows the menu for a selected discourse node when enabled", () => {
    expect(
      shouldShowNodeCardContextMenu({
        isEnabled: true,
        selectedShapeType: "discourse-node",
      }),
    ).toBe(true);
  });
});

describe("nodeCardContextMenuReducer", () => {
  it("opens on Context and switches tabs", () => {
    const initialState = createNodeCardContextMenuState("shape:one");
    const stylingState = nodeCardContextMenuReducer(initialState, {
      type: "select-tab",
      tab: "styling",
    });

    expect(initialState.activeTab).toBe("context");
    expect(stylingState.activeTab).toBe("styling");
  });

  it("keeps the chosen tab for the same node and resets for a new node", () => {
    const stylingState = {
      activeTab: "styling" as const,
      selectedShapeId: "shape:one",
    };

    expect(
      nodeCardContextMenuReducer(stylingState, {
        type: "sync-selection",
        selectedShapeId: "shape:one",
      }),
    ).toBe(stylingState);

    expect(
      nodeCardContextMenuReducer(stylingState, {
        type: "sync-selection",
        selectedShapeId: "shape:two",
      }),
    ).toEqual({
      activeTab: "context",
      selectedShapeId: "shape:two",
    });
  });
});

describe("groupRelationsByType", () => {
  it("groups incoming and outgoing relations and preserves empty relation types", () => {
    const linkedFiles = new Map([
      ["node:claim", { path: "Claims/A claim.md" }],
      ["node:evidence", { path: "Evidence/An observation.md" }],
    ]);

    const groups = groupRelationsByType({
      activeNodeTypeId: "type:question",
      nodeInstanceId: "node:question",
      relationTypes: [
        {
          id: "relation:supports",
          label: "supports",
          complement: "is supported by",
        },
        {
          id: "relation:informs",
          label: "informs",
          complement: "is informed by",
        },
      ],
      discourseRelations: [
        {
          sourceId: "type:question",
          destinationId: "type:claim",
          relationshipTypeId: "relation:supports",
        },
        {
          sourceId: "type:evidence",
          destinationId: "type:question",
          relationshipTypeId: "relation:supports",
        },
        {
          sourceId: "type:question",
          destinationId: "type:evidence",
          relationshipTypeId: "relation:informs",
        },
      ],
      relations: [
        {
          type: "relation:supports",
          source: "node:question",
          destination: "node:claim",
        },
        {
          type: "relation:supports",
          source: "node:evidence",
          destination: "node:question",
        },
        {
          type: "relation:supports",
          source: "node:question",
          destination: "node:claim",
        },
        {
          type: "relation:supports",
          source: "node:unrelated-a",
          destination: "node:unrelated-b",
        },
      ],
      getLinkedFile: (nodeInstanceId) =>
        linkedFiles.get(nodeInstanceId) ?? null,
    });

    expect(groups).toEqual([
      {
        key: "relation:supports-source",
        label: "supports",
        isSource: true,
        relationTypeId: "relation:supports",
        linkedFiles: [{ path: "Claims/A claim.md" }],
      },
      {
        key: "relation:supports-destination",
        label: "is supported by",
        isSource: false,
        relationTypeId: "relation:supports",
        linkedFiles: [{ path: "Evidence/An observation.md" }],
      },
      {
        key: "relation:informs-source",
        label: "informs",
        isSource: true,
        relationTypeId: "relation:informs",
        linkedFiles: [],
      },
    ]);
  });
});

describe("runRelationCanvasAction", () => {
  it("adds a relation that is not on the canvas", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);

    await expect(
      runRelationCanvasAction({
        hasExistingRelation: false,
        add,
        remove,
      }),
    ).resolves.toBe("add");
    expect(add).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes a relation that is already on the canvas", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);

    await expect(
      runRelationCanvasAction({
        hasExistingRelation: true,
        add,
        remove,
      }),
    ).resolves.toBe("remove");
    expect(remove).toHaveBeenCalledOnce();
    expect(add).not.toHaveBeenCalled();
  });
});
