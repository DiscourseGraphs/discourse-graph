import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocsPageHeading } from "./DocsPageHeading";

describe("DocsPageHeading", () => {
  it("places attribution after an authored MDX heading", () => {
    const markup = renderToStaticMarkup(
      DocsPageHeading({
        headingComponent: "h1",
        headingProps: { children: "How to use experiments" },
        metadata: {
          title: "Experiment tracking",
          author: "Documentation team",
          date: "2026-06-29",
        },
      }),
    );

    expect(markup).toContain(
      '<h1>How to use experiments</h1><p class="mt-2 text-sm text-gray-500">',
    );
    expect(markup).toContain(
      'By Documentation team · Published <time dateTime="2026-06-29">June 29, 2026</time>',
    );
    expect(markup).not.toContain("Last updated");
  });
});
