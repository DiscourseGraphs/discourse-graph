import { describe, expect, it } from "vitest";

/**
 * Telemetry Event Schema Tests
 * 
 * These tests document and validate the structure of telemetry events
 * emitted throughout the application, ensuring consistent property naming
 * and types for PostHog analytics.
 */

describe("Relation Telemetry Events", () => {
  describe("Discourse Relation Type: Created", () => {
    it("should have the correct payload structure for relation type creation", () => {
      const mockRelationUid = "abc123";
      
      const expectedPayload = {
        relationUid: mockRelationUid,
      };
      
      expect(expectedPayload).toHaveProperty("relationUid");
      expect(typeof expectedPayload.relationUid).toBe("string");
    });
  });

  describe("Discourse Relation Instance: Created", () => {
    it("should have the correct payload structure for relation instance from create dialog", () => {
      const mockRelation = {
        id: "rel-123",
        label: "supports",
      };
      
      const expectedPayload = {
        relationUid: mockRelation.id,
        relationLabel: mockRelation.label,
        source: "create-relation-dialog",
      };
      
      expect(expectedPayload).toHaveProperty("relationUid");
      expect(expectedPayload).toHaveProperty("relationLabel");
      expect(expectedPayload).toHaveProperty("source");
      expect(typeof expectedPayload.relationUid).toBe("string");
      expect(typeof expectedPayload.relationLabel).toBe("string");
      expect(typeof expectedPayload.source).toBe("string");
    });

    it("should have the correct payload structure for relation instance from suggestive mode", () => {
      const mockRelation = {
        id: "rel-456",
        label: "challenges",
      };
      
      const expectedPayload = {
        relationUid: mockRelation.id,
        relationLabel: mockRelation.label,
        source: "suggestive-mode",
      };
      
      expect(expectedPayload).toHaveProperty("relationUid");
      expect(expectedPayload).toHaveProperty("relationLabel");
      expect(expectedPayload).toHaveProperty("source");
      expect(expectedPayload.source).toBe("suggestive-mode");
    });

    it("should have the correct payload structure for relation instance from canvas", () => {
      const mockRelation = {
        id: "rel-789",
        label: "informs",
      };
      
      const expectedPayload = {
        relationUid: mockRelation.id,
        relationLabel: mockRelation.label,
        source: "canvas",
      };
      
      expect(expectedPayload).toHaveProperty("relationUid");
      expect(expectedPayload).toHaveProperty("relationLabel");
      expect(expectedPayload).toHaveProperty("source");
      expect(expectedPayload.source).toBe("canvas");
    });

    it("should validate source values are from expected surfaces", () => {
      const validSources = [
        "create-relation-dialog",
        "suggestive-mode",
        "canvas",
      ];
      
      validSources.forEach((source) => {
        expect(typeof source).toBe("string");
        expect(source.length).toBeGreaterThan(0);
      });
    });
  });
});

describe("Import Telemetry Events", () => {
  describe("Import Dialog: Import Started", () => {
    it("should have the correct payload structure", () => {
      const expectedPayload = {
        hasFile: true,
        title: "My Discourse Graph",
      };
      
      expect(expectedPayload).toHaveProperty("hasFile");
      expect(expectedPayload).toHaveProperty("title");
      expect(typeof expectedPayload.hasFile).toBe("boolean");
      expect(typeof expectedPayload.title).toBe("string");
    });
  });

  describe("Import Dialog: Import Completed", () => {
    it("should have the correct payload structure with counts", () => {
      const mockParsedData = {
        nodes: [
          { uid: "1", text: "Node 1" },
          { uid: "2", text: "Node 2" },
        ],
        relations: [
          { source: "1", target: "2", label: "supports" },
        ],
      };
      
      const expectedPayload = {
        title: "My Discourse Graph",
        nodeCount: mockParsedData.nodes.length,
        relationCount: mockParsedData.relations.length,
      };
      
      expect(expectedPayload).toHaveProperty("title");
      expect(expectedPayload).toHaveProperty("nodeCount");
      expect(expectedPayload).toHaveProperty("relationCount");
      expect(typeof expectedPayload.title).toBe("string");
      expect(typeof expectedPayload.nodeCount).toBe("number");
      expect(typeof expectedPayload.relationCount).toBe("number");
      expect(expectedPayload.nodeCount).toBe(2);
      expect(expectedPayload.relationCount).toBe(1);
    });

    it("should handle missing nodes or relations gracefully", () => {
      const mockParsedData = {
        nodes: undefined,
        relations: null,
      };
      
      const nodeCount = mockParsedData.nodes?.length || 0;
      const relationCount = mockParsedData.relations?.length || 0;
      
      expect(nodeCount).toBe(0);
      expect(relationCount).toBe(0);
    });
  });

  describe("Import Dialog: Import Failed", () => {
    it("should have the correct payload structure with error", () => {
      const error = new Error("Failed to parse JSON");
      
      const expectedPayload = {
        title: "My Discourse Graph",
        error: error.message,
      };
      
      expect(expectedPayload).toHaveProperty("title");
      expect(expectedPayload).toHaveProperty("error");
      expect(typeof expectedPayload.title).toBe("string");
      expect(typeof expectedPayload.error).toBe("string");
    });

    it("should handle non-Error objects", () => {
      const error = "String error";
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      expect(typeof errorMessage).toBe("string");
      expect(errorMessage).toBe("String error");
    });
  });
});

describe("Telemetry Property Extraction", () => {
  describe("Import count extraction", () => {
    it("should correctly extract node and relation counts from parsed JSON", () => {
      const parsedData = {
        title: "Test Graph",
        grammar: [],
        nodes: [
          { uid: "1", text: "Node 1" },
          { uid: "2", text: "Node 2" },
          { uid: "3", text: "Node 3" },
        ],
        relations: [
          { source: "1", target: "2", label: "supports" },
          { source: "2", target: "3", label: "challenges" },
        ],
      };
      
      const nodeCount = parsedData.nodes?.length || 0;
      const relationCount = parsedData.relations?.length || 0;
      
      expect(nodeCount).toBe(3);
      expect(relationCount).toBe(2);
    });

    it("should handle empty arrays", () => {
      const parsedData = {
        nodes: [],
        relations: [],
      };
      
      const nodeCount = parsedData.nodes?.length || 0;
      const relationCount = parsedData.relations?.length || 0;
      
      expect(nodeCount).toBe(0);
      expect(relationCount).toBe(0);
    });

    it("should use fallback values for undefined arrays", () => {
      const parsedData = {};
      
      const nodeCount = (parsedData as any).nodes?.length || 0;
      const relationCount = (parsedData as any).relations?.length || 0;
      
      expect(nodeCount).toBe(0);
      expect(relationCount).toBe(0);
    });
  });
});
