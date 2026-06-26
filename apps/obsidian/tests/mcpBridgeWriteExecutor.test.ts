import assert from "node:assert/strict";
import test from "node:test";
import { describeWriteOperation } from "../src/services/mcpBridgeWrite.types.js";

const schema = {
  nodeTypes: [{ id: "claim", name: "Claim" }],
  relationTypes: [{ id: "supports", label: "supports" }],
};

test("describeWriteOperation summarizes create_node", () => {
  const text = describeWriteOperation(
    {
      kind: "create_node",
      nodeTypeId: "claim",
      content: "What is MCP?",
      body: "draft",
    },
    schema,
  );
  assert.match(text, /Create Claim/);
  assert.match(text, /What is MCP\?/);
});

test("describeWriteOperation summarizes update_node title and body", () => {
  const text = describeWriteOperation(
    {
      kind: "update_node",
      nodeInstanceId: "node-1",
      title: "New title",
      content: "New body",
    },
    schema,
  );
  assert.match(text, /Update node-1/);
  assert.match(text, /title/);
  assert.match(text, /body/);
});
