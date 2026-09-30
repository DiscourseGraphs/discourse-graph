import { TFile, type App } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryEngine } from "~/services/QueryEngine";

type Frontmatter = Record<string, unknown>;

const createFile = (path: string): TFile => {
  const file = new TFile();
  file.path = path;
  file.name = path.split("/").at(-1) ?? path;
  file.basename = file.name.replace(/\.md$/, "");
  return file;
};

const createApp = ({
  datacoreInitialized,
  datacoreQuery,
  files,
  frontmatterByPath,
}: {
  datacoreInitialized: boolean;
  datacoreQuery: ReturnType<typeof vi.fn>;
  files: TFile[];
  frontmatterByPath: Record<string, Frontmatter>;
}) => {
  const getMarkdownFiles = vi.fn(() => files);
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const app = {
    metadataCache: {
      getFileCache: (file: TFile) => ({
        frontmatter: frontmatterByPath[file.path],
      }),
    },
    plugins: {
      plugins: {
        datacore: {
          api: {
            core: {
              initialized: datacoreInitialized,
            },
            query: datacoreQuery,
          },
        },
      },
    },
    vault: {
      getAbstractFileByPath: (path: string) => filesByPath.get(path) ?? null,
      getFileByPath: (path: string) => filesByPath.get(path) ?? null,
      getMarkdownFiles,
    },
  } as unknown as App;

  return { app, getMarkdownFiles };
};

describe("QueryEngine Datacore readiness", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the metadata cache without querying Datacore while it initializes", () => {
    const claim = createFile("CLAIM - Microglia change in AD.md");
    const datacoreQuery = vi.fn(() => []);
    const { app, getMarkdownFiles } = createApp({
      datacoreInitialized: false,
      datacoreQuery,
      files: [claim],
      frontmatterByPath: {
        [claim.path]: { nodeTypeId: "claim" },
      },
    });

    const results = new QueryEngine(app).searchDiscourseNodesByTitle(
      "Microglia",
    );

    expect(results).toEqual([claim]);
    expect(datacoreQuery).not.toHaveBeenCalled();
    expect(getMarkdownFiles).toHaveBeenCalledOnce();
  });

  it("treats an empty result as authoritative after Datacore initializes", () => {
    const claim = createFile("CLAIM - Microglia change in AD.md");
    const datacoreQuery = vi.fn(() => []);
    const { app, getMarkdownFiles } = createApp({
      datacoreInitialized: true,
      datacoreQuery,
      files: [claim],
      frontmatterByPath: {
        [claim.path]: { nodeTypeId: "claim" },
      },
    });

    const results = new QueryEngine(app).searchDiscourseNodesByTitle(
      "Microglia",
    );

    expect(results).toEqual([]);
    expect(datacoreQuery).toHaveBeenCalledOnce();
    expect(getMarkdownFiles).not.toHaveBeenCalled();
  });

  it("falls back to the metadata cache when an initialized query throws", () => {
    const claim = createFile("CLAIM - Microglia change in AD.md");
    const datacoreQuery = vi.fn(() => {
      throw new Error("Datacore query failed");
    });
    const { app, getMarkdownFiles } = createApp({
      datacoreInitialized: true,
      datacoreQuery,
      files: [claim],
      frontmatterByPath: {
        [claim.path]: { nodeTypeId: "claim" },
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const results = new QueryEngine(app).searchDiscourseNodesByTitle(
      "Microglia",
    );

    expect(results).toEqual([claim]);
    expect(datacoreQuery).toHaveBeenCalledOnce();
    expect(getMarkdownFiles).toHaveBeenCalledOnce();
  });

  it("enumerates discourse nodes from the metadata cache during initialization", () => {
    const claim = createFile("CLAIM - Microglia change in AD.md");
    const plainNote = createFile("Meeting notes.md");
    const datacoreQuery = vi.fn(() => []);
    const { app, getMarkdownFiles } = createApp({
      datacoreInitialized: false,
      datacoreQuery,
      files: [claim, plainNote],
      frontmatterByPath: {
        [claim.path]: { nodeTypeId: "claim" },
        [plainNote.path]: {},
      },
    });

    const results = new QueryEngine(app).getFilesWithNodeTypeId();

    expect(results).toEqual([claim]);
    expect(datacoreQuery).not.toHaveBeenCalled();
    expect(getMarkdownFiles).toHaveBeenCalledOnce();
  });

  it("finds compatible nodes from the metadata cache during initialization", () => {
    const activeClaim = createFile("CLAIM - Active claim.md");
    const existingEvidence = createFile("EVIDENCE - Existing result.md");
    const matchingEvidence = createFile("EVIDENCE - Microglia result.md");
    const datacoreQuery = vi.fn(() => []);
    const { app } = createApp({
      datacoreInitialized: false,
      datacoreQuery,
      files: [activeClaim, existingEvidence, matchingEvidence],
      frontmatterByPath: {
        [activeClaim.path]: {
          nodeTypeId: "claim",
          supports: `[[${existingEvidence.basename}]]`,
        },
        [existingEvidence.path]: { nodeTypeId: "evidence" },
        [matchingEvidence.path]: { nodeTypeId: "evidence" },
      },
    });

    const results = new QueryEngine(app).searchCompatibleNodeByTitle({
      query: "result",
      compatibleNodeTypeIds: ["evidence"],
      activeFile: activeClaim,
      selectedRelationType: "supports",
    });

    expect(results).toEqual([matchingEvidence]);
    expect(datacoreQuery).not.toHaveBeenCalled();
  });
});
