import assert from "node:assert/strict";
import test from "node:test";
import { createDgDocument } from "./text";
import { validateDgDocument } from "./validate";

void test("validates a simple DgDocument", () => {
  const document = createDgDocument({
    title: "A title",
    body: {
      text: "A body\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 7,
          attributes: {
            blockId: "b1",
            depth: 0,
            viewType: "paragraph",
          },
        },
      ],
    },
  });
  assert.deepEqual(validateDgDocument(document), { valid: true, errors: [] });
});

void test("rejects invalid spans and missing block parents", () => {
  const document = createDgDocument({
    title: "A title",
    body: {
      text: "A body\n",
      annotations: [
        {
          type: "block",
          start: 4,
          end: 4,
          attributes: {
            blockId: "b1",
            parentBlockId: "missing",
            depth: 1,
            viewType: "paragraph",
          },
        },
      ],
    },
  });
  const result = validateDgDocument(document);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("non-empty")));
  assert.ok(result.errors.some((error) => error.includes("missing parent")));
});
