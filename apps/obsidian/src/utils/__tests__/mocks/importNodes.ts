import { vi } from "vitest";

vi.mock("../../supabaseContext", () => ({
  getLoggedInClient: vi.fn(),
  getSupabaseContext: vi.fn(),
  getVaultId: () => "local-vault",
  getLocalSpaceUri: () => "obsidian:local-vault",
}));
vi.mock("../../publishNode", () => ({
  publishNewRelation: vi.fn().mockResolvedValue(false),
}));
vi.mock("../../templates", () => ({ createTemplateFile: vi.fn() }));
vi.mock("../../importFolderMetadata", () => ({
  resolveFolderForSpaceUri: vi.fn().mockResolvedValue("import/Research"),
}));
vi.mock("../../importRelations", () => ({
  importRelationsForImportedNodes: vi.fn().mockResolvedValue({ imported: 0 }),
}));
