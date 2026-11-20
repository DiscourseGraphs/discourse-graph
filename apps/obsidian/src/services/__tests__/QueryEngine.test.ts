import { TFile, type App } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryEngine,
  rankDiscourseNodesByTitle,
  type SearchableNode,
} from "~/services/QueryEngine";
import type { DiscourseNode } from "~/types";

// Stand-in scorer: earlier substring hits score higher, mirroring fuzzy search's ordering.
vi.mock("obsidian", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prepareFuzzySearch: (query: string) => (text: string) => {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    return index < 0
      ? null
      : { score: -index, matches: [[index, index + query.length]] };
  },
}));

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

type VaultNote = {
  path: string;
  content: string;
  frontmatter?: Frontmatter;
};

const CLAIM: DiscourseNode = {
  id: "claim",
  name: "Claim",
  format: "CLM - {content}",
  tag: "clm-candidate",
  created: 0,
  modified: 0,
};

const EVIDENCE: DiscourseNode = {
  id: "evidence",
  name: "Evidence",
  format: "EVD - {content}",
  tag: "evd-candidate",
  created: 0,
  modified: 0,
};

// Mirrors Obsidian's metadataCache: tags are indexed per line, case preserved.
const createVaultApp = (notes: VaultNote[]) => {
  const files = notes.map((note) => createFile(note.path));
  const noteByPath = new Map(notes.map((note) => [note.path, note]));
  const cachedRead = vi.fn((file: TFile) =>
    Promise.resolve(noteByPath.get(file.path)?.content ?? ""),
  );
  const app = {
    metadataCache: {
      getFileCache: (file: TFile) => {
        const note = noteByPath.get(file.path);
        if (!note) return null;
        const tags = note.content.split("\n").flatMap((text, line) =>
          [...text.matchAll(/#[\w-]+/g)].map((match) => ({
            tag: match[0],
            position: { start: { line, col: match.index, offset: 0 } },
          })),
        );
        return { frontmatter: note.frontmatter, tags };
      },
    },
    plugins: { plugins: {} },
    vault: { getMarkdownFiles: () => files, cachedRead },
  } as unknown as App;
  return { app, cachedRead };
};

describe("QueryEngine.getSearchableNodes", () => {
  const IMPORTED_QUESTION: DiscourseNode = {
    id: "remote-question",
    name: "Question",
    format: "QUE - {content}",
    created: 0,
    modified: 0,
    importedFromRid: "orn:obsidian.schema:remote-vault/remote-question",
  };
  const nodeTypes = [CLAIM, IMPORTED_QUESTION];

  const files = {
    claim: createFile("CLM - Local claim.md"),
    imported: createFile("import/remote-vault/QUE - Imported question.md"),
    unknown: createFile("Stray note.md"),
    empty: createFile("Empty type.md"),
    nonString: createFile("Numeric type.md"),
  };
  const frontmatterByPath: Record<string, Frontmatter> = {
    [files.claim.path]: { nodeTypeId: "claim" },
    [files.imported.path]: {
      nodeTypeId: "remote-question",
      importedFromRid: "orn:obsidian.note:remote-vault/abc",
    },
    [files.unknown.path]: { nodeTypeId: "bogus" },
    [files.empty.path]: { nodeTypeId: "" },
    [files.nonString.path]: { nodeTypeId: 42 },
  };
  const allFiles = Object.values(files);

  it.each([
    { path: "Datacore", datacoreInitialized: true },
    { path: "the vault-scan fallback", datacoreInitialized: false },
  ])(
    "keeps only configured local and imported node types via $path",
    ({ datacoreInitialized }) => {
      const datacoreQuery = vi.fn(() =>
        allFiles.map((file) => ({ $path: file.path })),
      );
      const { app, getMarkdownFiles } = createApp({
        datacoreInitialized,
        datacoreQuery,
        files: allFiles,
        frontmatterByPath,
      });

      const nodes = new QueryEngine(app).getSearchableNodes(nodeTypes);

      expect(nodes.map((node) => [node.file.path, node.nodeTypeId])).toEqual([
        [files.claim.path, "claim"],
        [files.imported.path, "remote-question"],
      ]);
      if (datacoreInitialized) {
        expect(datacoreQuery).toHaveBeenCalledOnce();
        expect(getMarkdownFiles).not.toHaveBeenCalled();
      } else {
        expect(datacoreQuery).not.toHaveBeenCalled();
        expect(getMarkdownFiles).toHaveBeenCalledOnce();
      }
    },
  );
});

describe("QueryEngine.getCandidateNodes", () => {
  it("returns only the tagged line of a paragraph as the candidate title", async () => {
    const { app } = createVaultApp([
      {
        path: "Meeting notes.md",
        content: "line 1: blah blah blah blah\nchange line here #clm-candidate",
      },
    ]);

    const candidates = await new QueryEngine(app).getCandidateNodes([CLAIM]);

    expect(candidates).toEqual([
      expect.objectContaining({
        title: "change line here",
        nodeTypeId: "claim",
        tagLine: { line: 1, tag: "clm-candidate" },
      }),
    ]);
    expect(candidates[0]?.file.path).toBe("Meeting notes.md");
  });

  it("strips list, task, heading and quote markers from candidate titles", async () => {
    const { app } = createVaultApp([
      {
        path: "Shapes.md",
        content: [
          "## Heading claim #clm-candidate",
          "- list claim #clm-candidate",
          "  - nested claim #clm-candidate",
          "- [ ] task claim #clm-candidate",
          "1. numbered claim #clm-candidate",
          "> quoted claim #clm-candidate",
          "# Top heading claim #clm-candidate",
        ].join("\n"),
      },
    ]);

    const candidates = await new QueryEngine(app).getCandidateNodes([CLAIM]);

    expect(candidates.map((c) => [c.title, c.tagLine?.line])).toEqual([
      ["Heading claim", 0],
      ["list claim", 1],
      ["nested claim", 2],
      ["task claim", 3],
      ["numbered claim", 4],
      ["quoted claim", 5],
      ["Top heading claim", 6],
    ]);
  });

  it("matches node tags case-insensitively and ignores other tags", async () => {
    const { app } = createVaultApp([
      {
        path: "Journal.md",
        content: [
          "Mixed case claim #CLM-Candidate",
          "Just a todo #todo",
          "Evidence line #evd-candidate",
        ].join("\n"),
      },
    ]);

    const candidates = await new QueryEngine(app).getCandidateNodes([CLAIM]);

    expect(candidates.map((c) => [c.title, c.nodeTypeId])).toEqual([
      ["Mixed case claim", "claim"],
    ]);
  });

  it("returns one candidate per node type when a line carries two node tags", async () => {
    const { app } = createVaultApp([
      {
        path: "Journal.md",
        content: "Dual line #clm-candidate #evd-candidate",
      },
    ]);

    const candidates = await new QueryEngine(app).getCandidateNodes([
      CLAIM,
      EVIDENCE,
    ]);

    expect(candidates.map((c) => [c.title, c.nodeTypeId])).toEqual([
      ["Dual line", "claim"],
      ["Dual line", "evidence"],
    ]);
  });

  it("collapses a node tag repeated on the same line into one candidate", async () => {
    const { app } = createVaultApp([
      {
        path: "Journal.md",
        content: "Repeated #clm-candidate and again #clm-candidate",
      },
    ]);

    const candidates = await new QueryEngine(app).getCandidateNodes([CLAIM]);

    expect(candidates).toHaveLength(1);
  });

  it("drops tagged lines with no text besides markers and tags", async () => {
    const { app } = createVaultApp([
      {
        path: "Journal.md",
        content: ["- #clm-candidate", "Real claim #clm-candidate"].join("\n"),
      },
    ]);

    const candidates = await new QueryEngine(app).getCandidateNodes([CLAIM]);

    expect(candidates.map((c) => c.title)).toEqual(["Real claim"]);
  });

  it("skips a file that fails to read and still returns the others", async () => {
    const { app, cachedRead } = createVaultApp([
      { path: "Broken.md", content: "Lost claim #clm-candidate" },
      { path: "Fine.md", content: "Kept claim #clm-candidate" },
    ]);
    cachedRead.mockImplementationOnce(() =>
      Promise.reject(new Error("read failed")),
    );

    const candidates = await new QueryEngine(app).getCandidateNodes([CLAIM]);

    expect(candidates.map((c) => c.title)).toEqual(["Kept claim"]);
  });

  it("reads only files that contain a node tag", async () => {
    const { app, cachedRead } = createVaultApp([
      { path: "Tagged.md", content: "A claim #clm-candidate" },
      { path: "Untagged.md", content: "Nothing here #todo" },
    ]);

    await new QueryEngine(app).getCandidateNodes([CLAIM]);

    expect(cachedRead.mock.calls.map(([file]) => file.path)).toEqual([
      "Tagged.md",
    ]);
  });
});

describe("rankDiscourseNodesByTitle with candidate nodes", () => {
  const node = (title: string, nodeTypeId = "claim"): SearchableNode => ({
    file: createFile(`${title}.md`),
    title,
    nodeTypeId,
  });
  const candidate = (title: string, nodeTypeId = "claim"): SearchableNode => ({
    file: createFile("Journal.md"),
    title,
    nodeTypeId,
    tagLine: { line: 3, tag: `${nodeTypeId}-candidate` },
  });

  it("filters candidates by node type like nodes", () => {
    const ranked = rankDiscourseNodesByTitle({
      candidates: [
        node("Sky claim"),
        candidate("Sky evidence", "evidence"),
        candidate("Sky candidate claim"),
      ],
      query: "",
      nodeTypeIds: ["claim"],
    });

    expect(ranked.map((r) => r.title)).toEqual([
      "Sky candidate claim",
      "Sky claim",
    ]);
  });

  it("ranks a better-matching candidate above a weaker node", () => {
    const ranked = rankDiscourseNodesByTitle({
      candidates: [node("Why the sky is blue"), candidate("Sky varies")],
      query: "sky",
    });

    expect(ranked.map((r) => r.title)).toEqual([
      "Sky varies",
      "Why the sky is blue",
    ]);
  });

  it("puts nodes before candidates on equal scores", () => {
    const ranked = rankDiscourseNodesByTitle({
      candidates: [candidate("Sky is blue"), node("Sky is blue")],
      query: "sky",
    });

    expect(ranked.map((r) => Boolean(r.tagLine))).toEqual([false, true]);
  });

  it("puts nodes before candidates on equal titles when the query is empty", () => {
    const ranked = rankDiscourseNodesByTitle({
      candidates: [candidate("Sky is blue"), node("Sky is blue")],
      query: "",
    });

    expect(ranked.map((r) => Boolean(r.tagLine))).toEqual([false, true]);
  });
});
