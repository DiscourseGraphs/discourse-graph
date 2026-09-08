import { describe, expect, it } from "vitest";
import { partitionByCoreTitle } from "../coreTitleBackfill";

describe("partitionByCoreTitle", () => {
  it("treats a null core_title as missing", () => {
    const { missingCoreTitleIds, withCoreTitleCount } = partitionByCoreTitle([
      { source_local_id: "a", core_title: null },
      { source_local_id: "b", core_title: "already set" },
    ]);

    expect([...missingCoreTitleIds]).toEqual(["a"]);
    expect(withCoreTitleCount).toBe(1);
  });

  it("counts an empty core_title as present", () => {
    const { missingCoreTitleIds, withCoreTitleCount } = partitionByCoreTitle([
      { source_local_id: "a", core_title: "" },
    ]);

    expect([...missingCoreTitleIds]).toEqual([]);
    expect(withCoreTitleCount).toBe(1);
  });

  it("ignores rows without a source_local_id", () => {
    const { missingCoreTitleIds, withCoreTitleCount } = partitionByCoreTitle([
      { source_local_id: null, core_title: null },
      { source_local_id: null, core_title: "set" },
    ]);

    expect([...missingCoreTitleIds]).toEqual([]);
    expect(withCoreTitleCount).toBe(0);
  });

  it("returns nothing to backfill for an empty probe", () => {
    const { missingCoreTitleIds, withCoreTitleCount } = partitionByCoreTitle(
      [],
    );

    expect([...missingCoreTitleIds]).toEqual([]);
    expect(withCoreTitleCount).toBe(0);
  });
});
