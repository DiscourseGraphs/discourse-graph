import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  filterDiscourseNodesByQuery,
  fromPopoverSelectedIds,
  getSelectAllCheckState,
  hasActiveTypeFilter,
  toPopoverSelectedIds,
} from "./discourseNodeTypeFilter";

const mockNode = (type: string, text: string): DiscourseNode =>
  ({ type, text }) as DiscourseNode;

const ALL_TYPE_IDS = ["claim", "evidence", "question"];

describe("hasActiveTypeFilter", () => {
  it("returns false when no types are selected (all types)", () => {
    assert.equal(
      hasActiveTypeFilter({ selectedTypeIds: [], allTypeIds: ALL_TYPE_IDS }),
      false,
    );
  });

  it("returns false when every type is selected", () => {
    assert.equal(
      hasActiveTypeFilter({
        selectedTypeIds: ALL_TYPE_IDS,
        allTypeIds: ALL_TYPE_IDS,
      }),
      false,
    );
  });

  it("returns true for a partial selection", () => {
    assert.equal(
      hasActiveTypeFilter({
        selectedTypeIds: ["claim"],
        allTypeIds: ALL_TYPE_IDS,
      }),
      true,
    );
  });
});

describe("toPopoverSelectedIds", () => {
  it("maps empty parent selection to all type ids for the popover", () => {
    assert.deepEqual(
      toPopoverSelectedIds({
        selectedTypeIds: [],
        allTypeIds: ALL_TYPE_IDS,
      }),
      ALL_TYPE_IDS,
    );
  });

  it("passes through a partial parent selection", () => {
    assert.deepEqual(
      toPopoverSelectedIds({
        selectedTypeIds: ["claim", "evidence"],
        allTypeIds: ALL_TYPE_IDS,
      }),
      ["claim", "evidence"],
    );
  });
});

describe("fromPopoverSelectedIds", () => {
  it("maps empty popover selection to no parent filter", () => {
    assert.deepEqual(
      fromPopoverSelectedIds({
        popoverSelectedIds: [],
        allTypeIds: ALL_TYPE_IDS,
      }),
      [],
    );
  });

  it("maps full popover selection to no parent filter", () => {
    assert.deepEqual(
      fromPopoverSelectedIds({
        popoverSelectedIds: ALL_TYPE_IDS,
        allTypeIds: ALL_TYPE_IDS,
      }),
      [],
    );
  });

  it("maps partial popover selection to parent filter ids", () => {
    assert.deepEqual(
      fromPopoverSelectedIds({
        popoverSelectedIds: ["claim"],
        allTypeIds: ALL_TYPE_IDS,
      }),
      ["claim"],
    );
  });
});

describe("getSelectAllCheckState", () => {
  it("returns off, on, and indeterminate for selection counts", () => {
    assert.equal(
      getSelectAllCheckState({ selectedIds: [], totalCount: 3 }),
      "off",
    );
    assert.equal(
      getSelectAllCheckState({ selectedIds: ["a", "b", "c"], totalCount: 3 }),
      "on",
    );
    assert.equal(
      getSelectAllCheckState({ selectedIds: ["a"], totalCount: 3 }),
      "indeterminate",
    );
  });
});

describe("filterDiscourseNodesByQuery", () => {
  const nodes = [
    mockNode("claim", "Claim"),
    mockNode("evidence", "Evidence"),
    mockNode("question", "Research Question"),
  ];

  it("returns all nodes when the query is empty", () => {
    assert.deepEqual(filterDiscourseNodesByQuery(nodes, ""), nodes);
    assert.deepEqual(filterDiscourseNodesByQuery(nodes, "   "), nodes);
  });

  it("filters nodes by label case-insensitively", () => {
    assert.deepEqual(filterDiscourseNodesByQuery(nodes, "quest"), [nodes[2]]);
  });
});
