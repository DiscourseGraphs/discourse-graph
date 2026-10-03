import { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import type { LocalConceptDataInput } from "@repo/database/inputTypes";
import { discourseNodeInstanceToLocalConcept } from "~/utils/conceptConversion";
import type { SupabaseContext } from "~/utils/supabaseContext";

const CONTEXT: SupabaseContext = {
  platform: "Obsidian",
  spaceId: 1,
  userId: 2,
  spacePassword: "",
};

const conceptFor = ({
  format,
  basename,
}: {
  format: string;
  basename: string;
}): LocalConceptDataInput => {
  const file = new TFile();
  file.basename = basename;
  file.path = `${basename}.md`;
  return discourseNodeInstanceToLocalConcept({
    context: CONTEXT,
    nodeData: {
      file,
      frontmatter: { nodeInstanceId: "node-1", nodeTypeId: "type-1" },
      nodeTypeId: "type-1",
      nodeInstanceId: "node-1",
      created: "",
      last_modified: "",
      changeTypes: [],
    },
    nodeTypesById: {
      "type-1": {
        id: "type-1",
        name: "Claim",
        format,
        created: 0,
        modified: 0,
      },
    },
  });
};

describe("discourseNodeInstanceToLocalConcept core_title", () => {
  it("extracts the content from a title matching the node type's format", () => {
    expect(
      conceptFor({ format: "CLM - {content}", basename: "CLM - sleep" }),
    ).toMatchObject({ literal_content: { core_title: "sleep" } });
  });

  it("extracts the content from a format with regex metacharacters", () => {
    expect(
      conceptFor({
        format: "Claim (draft) - {content}",
        basename: "Claim (draft) - sleep improves memory",
      }),
    ).toMatchObject({
      literal_content: { core_title: "sleep improves memory" },
    });
  });
});
