import { describe, expect, it } from "vitest";
import type { CrossAppNode } from "@repo/database/crossAppNodeContract";
import type { json } from "~/utils/getBlockProps";
import { DISCOURSE_GRAPH_PROP_NAME } from "~/utils/createReifiedBlock";
import {
  IMPORTED_FROM_PROP_KEY,
  parseImportedSourceIdentity,
  toImportedSourceIdentity,
  type ImportedSourceIdentity,
} from "~/utils/importedSourceIdentity";

const identity: ImportedSourceIdentity = {
  sourceApp: "obsidian",
  sourceSpaceId: "obsidian:9a8b7c6d5e4f3210",
  sourceNodeId: "0192f1a0-7b3c-7e2a-9f10-1a2b3c4d5e6f",
  sourceNodeRid:
    "orn:obsidian.note:9a8b7c6d5e4f3210/0192f1a0-7b3c-7e2a-9f10-1a2b3c4d5e6f",
  sourceTitle: "EVD - REM sleep and recall",
  sourceModifiedAt: "2026-06-14T10:30:00.000Z",
};

const propsWithImportedFrom = (
  importedFrom: json,
  siblingProps: Record<string, json> = {},
): Record<string, json> => ({
  [DISCOURSE_GRAPH_PROP_NAME]: {
    ...siblingProps,
    [IMPORTED_FROM_PROP_KEY]: importedFrom,
  },
});

describe("toImportedSourceIdentity", () => {
  it("maps the six identity fields from a cross-app node, using direct content as title", () => {
    const node: CrossAppNode = {
      sourceApp: "obsidian",
      sourceSpaceId: identity.sourceSpaceId,
      sourceSpaceName: "Research Vault",
      sourceNodeId: identity.sourceNodeId,
      sourceNodeRid: identity.sourceNodeRid,
      nodeType: { sourceNodeTypeId: "evd-7c1f9a2b", label: "Evidence" },
      content: {
        direct: { value: identity.sourceTitle },
        full: { format: "text/markdown", value: "# body\n" },
      },
      sourceModifiedAt: identity.sourceModifiedAt,
    };

    const result = toImportedSourceIdentity(node);

    expect(result).toEqual(identity);
    expect(Object.keys(result).sort()).toEqual(
      [
        "sourceApp",
        "sourceModifiedAt",
        "sourceNodeId",
        "sourceNodeRid",
        "sourceSpaceId",
        "sourceTitle",
      ].sort(),
    );
  });
});

describe("parseImportedSourceIdentity", () => {
  it("round-trips a stored identity", () => {
    expect(
      parseImportedSourceIdentity(propsWithImportedFrom(identity)),
    ).toEqual(identity);
  });

  it("ignores sibling discourse-graph props", () => {
    const props = propsWithImportedFrom(identity, {
      "relation-migration": { abc123: 1718000000000 },
    });
    expect(parseImportedSourceIdentity(props)).toEqual(identity);
  });

  it("returns undefined when there are no discourse-graph props", () => {
    expect(parseImportedSourceIdentity({})).toBeUndefined();
  });

  it("returns undefined when discourse-graph has no importedFrom", () => {
    expect(
      parseImportedSourceIdentity({
        [DISCOURSE_GRAPH_PROP_NAME]: { "relation-migration": {} },
      }),
    ).toBeUndefined();
  });

  it("returns undefined when a required field is missing", () => {
    const withoutRid = {
      sourceApp: identity.sourceApp,
      sourceSpaceId: identity.sourceSpaceId,
      sourceNodeId: identity.sourceNodeId,
      sourceTitle: identity.sourceTitle,
      sourceModifiedAt: identity.sourceModifiedAt,
    };
    expect(
      parseImportedSourceIdentity(propsWithImportedFrom(withoutRid)),
    ).toBeUndefined();
  });

  it("returns undefined when a field has the wrong type", () => {
    expect(
      parseImportedSourceIdentity(
        propsWithImportedFrom({ ...identity, sourceModifiedAt: 1718000000000 }),
      ),
    ).toBeUndefined();
  });

  it("returns undefined for an unknown sourceApp", () => {
    expect(
      parseImportedSourceIdentity(
        propsWithImportedFrom({ ...identity, sourceApp: "notion" }),
      ),
    ).toBeUndefined();
  });
});
