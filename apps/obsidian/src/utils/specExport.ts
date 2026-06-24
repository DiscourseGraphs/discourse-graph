import { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
} from "~/types";
import {
  DG_SCHEMA_EXPORT_VERSION,
  getDgSchemaFileName,
  parseDgSchemaFile,
  type DgSchemaFile,
  type TemplateExportRecord,
} from "~/utils/specValidation";
import { getTemplatePluginInfo } from "~/utils/templates";

export type SpecExportSelection = {
  nodeTypeIds: string[];
  relationTypeIds: string[];
  discourseRelationIds: string[];
  templateNames: string[];
};

export type SpecExportDependencySummary = {
  autoIncludedNodeTypeIds: string[];
  autoIncludedRelationTypeIds: string[];
};

export type SpecExportResult = {
  filePath: string;
  payload: DgSchemaFile;
  dependencySummary: SpecExportDependencySummary;
  warnings: string[];
};

type BuildPayloadResult = {
  payload: DgSchemaFile;
  dependencySummary: SpecExportDependencySummary;
  warnings: string[];
};

type SaveDialogResult = {
  canceled: boolean;
  filePath?: string;
};

type ElectronDialog = {
  showSaveDialog: (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }) => Promise<SaveDialogResult>;
};

type ElectronLike = {
  dialog?: ElectronDialog;
  remote?: {
    dialog?: ElectronDialog;
  };
};

type FsPromisesLike = {
  writeFile: (path: string, data: string, encoding: string) => Promise<void>;
};

class ExportSaveCancelledError extends Error {
  constructor() {
    super("Export cancelled");
    this.name = "ExportSaveCancelledError";
  }
}

const asMap = <T extends { id: string }>(items: T[]): Map<string, T> => {
  return new Map(items.map((item) => [item.id, item]));
};

const isUserCancellationError = (error: unknown): boolean => {
  return (
    error instanceof ExportSaveCancelledError ||
    (error instanceof Error && error.name === "AbortError")
  );
};

const isElectronDialog = (value: unknown): value is ElectronDialog => {
  return (
    typeof value === "object" &&
    value !== null &&
    "showSaveDialog" in value &&
    typeof (value as { showSaveDialog: unknown }).showSaveDialog === "function"
  );
};

const getElectronDialog = (value: unknown): ElectronDialog | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const electronLike = value as ElectronLike;
  const directDialog = electronLike.dialog;
  if (isElectronDialog(directDialog)) {
    return directDialog;
  }
  const remoteDialog = electronLike.remote?.dialog;
  if (isElectronDialog(remoteDialog)) {
    return remoteDialog;
  }
  return null;
};

const saveWithFileSystemAccessApi = async ({
  fileName,
  content,
}: {
  fileName: string;
  content: string;
}): Promise<string | null> => {
  if (typeof window === "undefined") {
    return null;
  }

  const picker = (
    window as Window & {
      showSaveFilePicker?: (options: {
        suggestedName: string;
        types: Array<{
          description: string;
          accept: Record<string, string[]>;
        }>;
      }) => Promise<{
        name: string;
        createWritable: () => Promise<{
          write: (data: string) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;

  if (!picker) {
    return null;
  }

  try {
    const fileHandle = await picker({
      suggestedName: fileName,
      types: [
        {
          description: "JSON files",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return fileHandle.name;
  } catch (error) {
    if (isUserCancellationError(error)) {
      throw new ExportSaveCancelledError();
    }
    throw error;
  }
};

const saveWithElectronDialog = async ({
  fileName,
  content,
}: {
  fileName: string;
  content: string;
}): Promise<string | null> => {
  if (typeof window === "undefined") {
    return null;
  }

  const windowWithRequire = window as Window & {
    require?: (name: string) => unknown;
  };
  if (!windowWithRequire.require) {
    return null;
  }

  const electron = windowWithRequire.require("electron");
  const dialog = getElectronDialog(electron);
  if (!dialog) {
    return null;
  }

  const result = await dialog.showSaveDialog({
    title: "Export discourse graph schema",
    defaultPath: fileName,
    filters: [{ name: "JSON files", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) {
    throw new ExportSaveCancelledError();
  }

  const fsPromises = windowWithRequire.require("fs/promises");
  if (
    typeof fsPromises !== "object" ||
    fsPromises === null ||
    !("writeFile" in fsPromises) ||
    typeof (fsPromises as { writeFile: unknown }).writeFile !== "function"
  ) {
    throw new Error("Unable to access filesystem write API for export.");
  }
  const typedFsPromises = fsPromises as FsPromisesLike;
  await typedFsPromises.writeFile(result.filePath, content, "utf8");
  return result.filePath;
};

const triggerBrowserDownload = ({
  fileName,
  content,
}: {
  fileName: string;
  content: string;
}): string => {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return fileName;
};

const getTemplateContents = async ({
  plugin,
  templateNames,
}: {
  plugin: DiscourseGraphPlugin;
  templateNames: string[];
}): Promise<{ templates: TemplateExportRecord[]; warnings: string[] }> => {
  const warnings: string[] = [];
  const templates: TemplateExportRecord[] = [];
  const { isEnabled, folderPath } = getTemplatePluginInfo(plugin.app);

  if (!isEnabled || !folderPath) {
    if (templateNames.length > 0) {
      warnings.push(
        "Templates plugin is not enabled or folder is not configured; template content was skipped.",
      );
    }
    return { templates, warnings };
  }

  for (const templateName of templateNames) {
    const templatePath = `${folderPath}/${templateName}.md`;
    const templateFile = plugin.app.vault.getAbstractFileByPath(templatePath);

    if (!(templateFile instanceof TFile)) {
      warnings.push(`Template file not found: ${templateName}.md`);
      continue;
    }

    const content = await plugin.app.vault.read(templateFile);
    templates.push({ name: templateName, content });
  }

  return { templates, warnings };
};

export const buildSchemaExportPayload = async ({
  plugin,
  selection,
}: {
  plugin: DiscourseGraphPlugin;
  selection: SpecExportSelection;
}): Promise<BuildPayloadResult> => {
  const nodeTypeMap = asMap(plugin.settings.nodeTypes);
  const relationTypeMap = asMap(plugin.settings.relationTypes);
  const discourseRelationMap = asMap(plugin.settings.discourseRelations);

  const selectedDiscourseRelations: DiscourseRelation[] =
    selection.discourseRelationIds
      .map((id) => discourseRelationMap.get(id))
      .filter((relation): relation is DiscourseRelation => !!relation);

  const dependencyRelationTypeIds = new Set<string>();
  const dependencyNodeTypeIds = new Set<string>();

  for (const relation of selectedDiscourseRelations) {
    dependencyRelationTypeIds.add(relation.relationshipTypeId);
    dependencyNodeTypeIds.add(relation.sourceId);
    dependencyNodeTypeIds.add(relation.destinationId);
  }

  const selectedRelationTypeIds = new Set(selection.relationTypeIds);
  for (const relationTypeId of dependencyRelationTypeIds) {
    selectedRelationTypeIds.add(relationTypeId);
  }

  const selectedNodeTypeIds = new Set(selection.nodeTypeIds);
  for (const nodeTypeId of dependencyNodeTypeIds) {
    selectedNodeTypeIds.add(nodeTypeId);
  }

  const selectedNodeTypes: DiscourseNode[] = [...selectedNodeTypeIds]
    .map((id) => nodeTypeMap.get(id))
    .filter((nodeType): nodeType is DiscourseNode => !!nodeType);

  const selectedRelationTypes: DiscourseRelationType[] = [
    ...selectedRelationTypeIds,
  ]
    .map((id) => relationTypeMap.get(id))
    .filter(
      (relationType): relationType is DiscourseRelationType => !!relationType,
    );

  const { templates, warnings } = await getTemplateContents({
    plugin,
    templateNames: selection.templateNames,
  });

  const payload = parseDgSchemaFile({
    version: DG_SCHEMA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    pluginVersion: plugin.manifest.version,
    vaultName: plugin.app.vault.getName(),
    nodeTypes: selectedNodeTypes,
    relationTypes: selectedRelationTypes,
    discourseRelations: selectedDiscourseRelations,
    templates,
  });

  return {
    payload,
    dependencySummary: {
      autoIncludedNodeTypeIds: [...dependencyNodeTypeIds].filter(
        (id) => !selection.nodeTypeIds.includes(id),
      ),
      autoIncludedRelationTypeIds: [...dependencyRelationTypeIds].filter(
        (id) => !selection.relationTypeIds.includes(id),
      ),
    },
    warnings,
  };
};

const saveSchemaExportFile = async ({
  fileName,
  content,
}: {
  fileName: string;
  content: string;
}): Promise<string> => {
  const fileSystemApiPath = await saveWithFileSystemAccessApi({
    fileName,
    content,
  });
  if (fileSystemApiPath) {
    return fileSystemApiPath;
  }

  const electronDialogPath = await saveWithElectronDialog({
    fileName,
    content,
  });
  if (electronDialogPath) {
    return electronDialogPath;
  }

  return triggerBrowserDownload({ fileName, content });
};

export const exportSchemaSelectionToVault = async ({
  plugin,
  selection,
}: {
  plugin: DiscourseGraphPlugin;
  selection: SpecExportSelection;
}): Promise<SpecExportResult> => {
  const { payload, dependencySummary, warnings } =
    await buildSchemaExportPayload({
      plugin,
      selection,
    });
  const serializedPayload = JSON.stringify(payload, null, 2);
  const fileName = getDgSchemaFileName(plugin.app.vault.getName());
  const filePath = await saveSchemaExportFile({
    fileName,
    content: serializedPayload,
  });

  return {
    filePath,
    payload,
    dependencySummary,
    warnings,
  };
};

export { ExportSaveCancelledError };
