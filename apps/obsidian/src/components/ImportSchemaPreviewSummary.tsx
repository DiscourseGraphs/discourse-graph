import type { SpecImportPreview } from "~/utils/specImport";

export const ImportSchemaPreviewSummary = ({
  preview,
}: {
  preview: SpecImportPreview;
}) => {
  return (
    <>
      <div className="mb-4 rounded border p-3 text-sm">
        <div className="font-medium">Archive metadata</div>
        <div className="text-muted mt-1">
          Vault:{" "}
          <span className="font-medium">{preview.archive.vaultName}</span>
        </div>
        <div className="text-muted">
          Exported at:{" "}
          <span className="font-medium">{preview.archive.exportedAt}</span>
        </div>
        <div className="text-muted">
          Plugin version:{" "}
          <span className="font-medium">{preview.archive.pluginVersion}</span>
        </div>
      </div>

      <div className="mb-4 rounded border p-3 text-sm">
        <div className="font-medium">Current preview stats (full archive)</div>
        <div className="text-muted mt-1">
          Node types: {preview.nodeTypes.total} total (
          {preview.nodeTypes.newCount} new, {preview.nodeTypes.matchedById} ID
          matches, {preview.nodeTypes.matchedByName} name matches)
        </div>
        <div className="text-muted">
          Relation types: {preview.relationTypes.total} total (
          {preview.relationTypes.newCount} new,{" "}
          {preview.relationTypes.matchedById} ID matches,{" "}
          {preview.relationTypes.matchedByLabel} label matches)
        </div>
        <div className="text-muted">
          Relation triples: {preview.discourseRelations.total} total (
          {preview.discourseRelations.newCount} new,{" "}
          {preview.discourseRelations.existingCount} existing)
        </div>
        <div className="text-muted">
          Templates: {preview.templates.total} total (
          {preview.templates.newCount} new, {preview.templates.existingCount}{" "}
          existing)
        </div>
      </div>
    </>
  );
};
