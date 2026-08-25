import type { ImportPreviewStats, LoadedSchemaFile } from "~/utils/specImport";

export const ImportSchemaPreviewSummary = ({
  loadedSchemaFile,
  previewStats,
}: {
  loadedSchemaFile: LoadedSchemaFile;
  previewStats: ImportPreviewStats;
}) => {
  return (
    <>
      <div className="mb-4 rounded border p-3 text-sm">
        <div className="font-medium">Schema file metadata</div>
        <div className="text-muted mt-1">
          Vault:{" "}
          <span className="font-medium">
            {loadedSchemaFile.schemaFile.vaultName}
          </span>
        </div>
        <div className="text-muted">
          Exported at:{" "}
          <span className="font-medium">
            {loadedSchemaFile.schemaFile.exportedAt}
          </span>
        </div>
        <div className="text-muted">
          Plugin version:{" "}
          <span className="font-medium">
            {loadedSchemaFile.schemaFile.pluginVersion}
          </span>
        </div>
      </div>

      <div className="mb-4 rounded border p-3 text-sm">
        <div className="font-medium">Preview (full schema file)</div>
        <div className="text-muted mt-1">
          Node types: {previewStats.nodeTypes.total} total (
          {previewStats.nodeTypes.new} new, {previewStats.nodeTypes.existing}{" "}
          existing)
        </div>
        <div className="text-muted">
          Relation types: {previewStats.relationTypes.total} total (
          {previewStats.relationTypes.new} new,{" "}
          {previewStats.relationTypes.existing} existing)
        </div>
        <div className="text-muted">
          Relation triples: {previewStats.discourseRelations.total} total (
          {previewStats.discourseRelations.new} new,{" "}
          {previewStats.discourseRelations.existing} existing)
        </div>
        <div className="text-muted">
          Templates: {previewStats.templates.total} total (
          {previewStats.templates.new} new, {previewStats.templates.existing}{" "}
          existing)
        </div>
      </div>
    </>
  );
};
