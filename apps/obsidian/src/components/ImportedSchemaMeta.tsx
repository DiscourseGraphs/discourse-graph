import { usePlugin } from "./PluginContext";
import { formatImportSource, getUserNameById } from "~/utils/typeUtils";

type ImportedSchemaMetaProps = {
  isProvisional: boolean;
  spaceUri?: string;
  authorId?: number;
};

/**
 * Attribution line shown under an imported relation or relation type: a
 * provisional badge plus who it came from. Colors come from Obsidian theme
 * variables so the badge follows the active theme in both light and dark mode.
 */
const ImportedSchemaMeta = ({
  isProvisional,
  spaceUri,
  authorId,
}: ImportedSchemaMetaProps) => {
  const plugin = usePlugin();

  return (
    <div className="text-muted flex flex-wrap items-center gap-2 text-xs">
      {isProvisional && (
        <span className="text-warning shrink-0 rounded bg-[rgba(var(--color-orange-rgb),0.15)] px-1.5 py-0.5 text-xs font-medium">
          Provisional
        </span>
      )}
      {spaceUri && (
        <span>
          {authorId && `by ${getUserNameById(plugin, authorId)} `}
          from {formatImportSource(spaceUri, plugin.settings.spaceNames)}
        </span>
      )}
    </div>
  );
};

export default ImportedSchemaMeta;
