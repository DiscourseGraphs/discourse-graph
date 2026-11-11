import { describe, expect, it } from "vitest";
import { PreviewErrorBoundary } from "~/components/PreviewErrorBoundary";

// Rendering the boundary needs a DOM this suite does not have, but the reset
// transition is a pure static, and it is the part that broke once already.
const error = new Error("preview failed");

describe("PreviewErrorBoundary reset transition", () => {
  it("leaves a healthy preview alone", () => {
    expect(
      PreviewErrorBoundary.getDerivedStateFromProps(
        { resetKey: "b", children: null },
        { error: null, errorKey: null },
      ),
    ).toBeNull();
  });

  // The regression guard: resetting here clears the error on the re-render that
  // follows the throw, so the children render and throw again.
  it("does not reset before componentDidCatch records the key", () => {
    expect(
      PreviewErrorBoundary.getDerivedStateFromProps(
        { resetKey: "b", children: null },
        { error, errorKey: null },
      ),
    ).toBeNull();
  });

  it("keeps the fallback while the result that threw stays selected", () => {
    expect(
      PreviewErrorBoundary.getDerivedStateFromProps(
        { resetKey: "a", children: null },
        { error, errorKey: "a" },
      ),
    ).toBeNull();
  });

  it("clears the error when another result is selected", () => {
    expect(
      PreviewErrorBoundary.getDerivedStateFromProps(
        { resetKey: "b", children: null },
        { error, errorKey: "a" },
      ),
    ).toEqual({ error: null, errorKey: null });
  });
});
