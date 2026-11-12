import { describe, expect, it } from "vitest";
import { validateNodeSearchTrigger } from "~/utils/nodeSearchTrigger";

describe("validateNodeSearchTrigger", () => {
  it("rejects a trigger the node tag hotkey would swallow", () => {
    expect(
      validateNodeSearchTrigger({ value: "\\", nodeTagHotkey: "\\" }),
    ).not.toBeNull();
    expect(
      validateNodeSearchTrigger({ value: "@\\", nodeTagHotkey: "\\" }),
    ).not.toBeNull();
  });

  it("rejects a trigger longer than 5 characters", () => {
    expect(
      validateNodeSearchTrigger({ value: "@@@@@@", nodeTagHotkey: "\\" }),
    ).not.toBeNull();
  });

  it("accepts the default, an empty trigger, and any trigger when no hotkey is set", () => {
    expect(
      validateNodeSearchTrigger({ value: "@", nodeTagHotkey: "\\" }),
    ).toBeNull();
    expect(
      validateNodeSearchTrigger({ value: "", nodeTagHotkey: "\\" }),
    ).toBeNull();
    expect(
      validateNodeSearchTrigger({ value: "@@", nodeTagHotkey: "" }),
    ).toBeNull();
  });
});
