import { describe, expect, it } from "vitest";

import {
  dgDocumentToRoamTree,
  roamTreeToDgDocument,
  type DgBlockAnnotation,
  type DgReferenceAnnotation,
  type RoamPage,
} from "@repo/content-model";

const page: RoamPage = {
  uid: "page-uid",
  title: "Canonical page",
  viewType: "bullet",
  children: [
    {
      uid: "parent",
      text: "Refs [[Page Name]], ((block-uid)), #tag, and #[[multi word]].",
      children: [
        {
          uid: "child",
          text: "[Link](https://example.com) and ![image](asset.png)",
          viewType: "number",
        },
      ],
    },
    {
      uid: "heading",
      text: "Section with `code`",
      heading: 2,
    },
    {
      uid: "code",
      text: "```ts\nconst value = 1;\n```",
    },
  ],
};

describe("Roam adapter", () => {
  it("parses references and explicit block hierarchy from a Roam-native tree", () => {
    const document = roamTreeToDgDocument({ page });
    const blocks = document.body.annotations.filter(
      (annotation): annotation is DgBlockAnnotation =>
        annotation.type === "block",
    );
    const references = document.body.annotations.filter(
      (annotation): annotation is DgReferenceAnnotation =>
        annotation.type === "reference",
    );

    expect(document.title.text).toBe("Canonical page");
    expect(blocks.find((block) => block.id === "child")?.parentId).toBe(
      "parent",
    );
    expect(
      blocks.find((block) => block.id === "child")?.attributes,
    ).toMatchObject({ depth: 1, listStyle: "number", sourceId: "child" });
    expect(
      blocks.find((block) => block.id === "heading")?.attributes,
    ).toMatchObject({ level: 2, sourceId: "heading" });
    expect(
      blocks.find((block) => block.id === "code")?.attributes,
    ).toMatchObject({ language: "ts", sourceId: "code" });
    expect(references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ referenceType: "page", target: "Page Name" }),
        expect.objectContaining({
          referenceType: "block",
          target: "block-uid",
        }),
        expect.objectContaining({ referenceType: "tag", target: "tag" }),
        expect.objectContaining({ referenceType: "tag", target: "multi word" }),
        expect.objectContaining({
          referenceType: "image",
          target: "asset.png",
        }),
      ]),
    );
  });

  it("renders the covered canonical structures back to a Roam tree", () => {
    const rendered = dgDocumentToRoamTree({
      document: roamTreeToDgDocument({ page }),
      pageUid: page.uid,
    });

    expect(rendered.title).toBe(page.title);
    expect(rendered.children[0]?.uid).toBe("parent");
    expect(rendered.children[0]?.text).toContain("[[Page Name|Page Name]]");
    expect(rendered.children[0]?.text).toContain("((block-uid))");
    expect(rendered.children[0]?.text).toContain("#[[multi word]]");
    expect(rendered.children[0]?.children?.[0]).toMatchObject({
      uid: "child",
      viewType: "number",
    });
    expect(rendered.children[2]?.text).toBe("```ts\nconst value = 1;\n```");
  });
});
