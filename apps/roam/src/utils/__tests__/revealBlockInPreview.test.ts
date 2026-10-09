// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  PREVIEW_FLASH_CLASS,
  revealBlockInPreview,
} from "~/components/AdvancedNodeSearchDialog/revealBlockInPreview";

// Mirrors the markup Roam's renderPage emits for one block and its children.
const block = (uid: string, children = ""): string =>
  `<div class="roam-block-container rm-block" data-block-uid="${uid}">` +
  `<div class="rm-block-main"><div class="rm-block__input roam-block"></div></div>` +
  `<div class="rm-block-children">${children}</div>` +
  `</div>`;

const mount = (html: string): HTMLElement => {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
};

const flashed = (root: ParentNode): string[] =>
  Array.from(root.querySelectorAll(`.${PREVIEW_FLASH_CLASS}`)).map(
    (el) => el.closest(".rm-block")?.getAttribute("data-block-uid") ?? "",
  );

afterEach(() => {
  document.body.innerHTML = "";
});

describe("revealBlockInPreview", () => {
  it("flashes only the tagged block's own row, not its children", () => {
    const container = mount(block("parent", block("tagged", block("child"))));

    revealBlockInPreview({ container, uid: "tagged" });

    const row = container.querySelector(
      '[data-block-uid="tagged"] > .rm-block-main',
    );
    expect(row?.classList.contains(PREVIEW_FLASH_CLASS)).toBe(true);
    expect(flashed(container)).toEqual(["tagged"]);
  });

  it("skips an embedded copy of the block that renders above the real one", () => {
    const embedHost =
      `<div class="roam-block-container rm-block" data-block-uid="host">` +
      `<div class="rm-block-main"><div class="rm-block__input roam-block">` +
      `<div class="rm-embed-container">${block("tagged")}</div>` +
      `</div></div></div>`;
    const container = mount(embedHost + block("tagged"));

    revealBlockInPreview({ container, uid: "tagged" });

    const flashedRows = container.querySelectorAll(`.${PREVIEW_FLASH_CLASS}`);
    expect(flashedRows).toHaveLength(1);
    expect(flashedRows[0]?.closest(".rm-embed-container")).toBeNull();
  });

  it("centres the tagged row within the preview's own scroll area", () => {
    const container = mount(block("tagged"));
    const row = container.querySelector<HTMLElement>(".rm-block-main")!;
    // jsdom has no layout, so stub the geometry the browser would report.
    Object.defineProperty(container, "clientHeight", { value: 400 });
    container.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    row.getBoundingClientRect = () => ({ top: 700, height: 40 }) as DOMRect;
    container.scrollTop = 50;

    revealBlockInPreview({ container, uid: "tagged" });

    expect(container.scrollTop).toBe(470);
  });

  it("clears the flash when switching away before it finishes", () => {
    const container = mount(block("tagged"));

    const cleanup = revealBlockInPreview({ container, uid: "tagged" });
    cleanup();

    expect(flashed(container)).toEqual([]);
  });

  it("clears the flash once its animation ends", () => {
    const container = mount(block("tagged"));

    revealBlockInPreview({ container, uid: "tagged" });
    container
      .querySelector(".rm-block-main")!
      .dispatchEvent(new Event("animationend"));

    expect(flashed(container)).toEqual([]);
  });

  it("ignores a copy of the block rendered outside the preview", () => {
    mount(block("tagged"));
    const container = mount(block("other"));

    revealBlockInPreview({ container, uid: "tagged" });

    expect(flashed(document.body)).toEqual([]);
  });

  it("scrolls back to the top without flashing when the block isn't rendered", () => {
    const container = mount(block("parent"));
    container.scrollTop = 240;

    revealBlockInPreview({ container, uid: "underCollapsedParent" });

    expect(container.scrollTop).toBe(0);
    expect(flashed(container)).toEqual([]);
  });
});
