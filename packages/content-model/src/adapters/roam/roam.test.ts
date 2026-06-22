import assert from "node:assert/strict";
import test from "node:test";
import { fromRoamTree, toRoamMarkdown, toRoamTree } from "./index";
import { validateDgDocument } from "../../validate";

void test("converts Roam native tree to a valid DgDocument", () => {
  const document = fromRoamTree({
    title: "Claim",
    titleUid: "pageuid123",
    children: [
      {
        uid: "blockone1",
        text: "A [[Page]] with #tag and ((blocktwo2))",
        children: [
          {
            uid: "blocktwo2",
            text: "**Child** [link](https://example.com)",
          },
        ],
      },
    ],
  });
  assert.equal(validateDgDocument(document).valid, true);
  assert.ok(
    document.body.annotations.some(
      (annotation) =>
        annotation.type === "reference" &&
        annotation.attributes.kind === "roam-page",
    ),
  );
  assert.ok(
    document.body.annotations.some(
      (annotation) =>
        annotation.type === "reference" &&
        annotation.attributes.kind === "roam-block",
    ),
  );
  const [root] = toRoamTree(document);
  assert.equal(root?.children?.[0]?.uid, "blocktwo2");
});

void test("renders Roam-style Markdown from canonical blocks", () => {
  const document = fromRoamTree({
    title: "Claim",
    children: [
      {
        uid: "blockone1",
        text: "A [[Page]]",
        children: [{ uid: "blocktwo2", text: "**Child**" }],
      },
    ],
  });
  assert.equal(toRoamMarkdown(document), "- A [[Page]]\n  - **Child**");
});
