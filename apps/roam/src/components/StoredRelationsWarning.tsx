import { Callout, Intent } from "@blueprintjs/core";
import React from "react";
import { ROAM_DOCS, withDocsLink } from "~/components/settings/utils/docs";
import { getStoredRelationsEnabled } from "~/utils/storedRelations";

const StoredRelationsWarning = ({
  className,
}: {
  className?: string;
}): React.ReactElement | null => {
  if (getStoredRelationsEnabled()) return null;
  return (
    <Callout
      className={className}
      intent={Intent.WARNING}
      title="Stored relations are disabled"
    >
      {withDocsLink(
        "Sharing and importing use stored relations. While stored relations are disabled, pattern-based relations aren't shared and imported relations don't appear. Enable stored relations in Personal Settings > Home.",
        ROAM_DOCS.migrationToStoredRelations,
      )}
    </Callout>
  );
};

export default StoredRelationsWarning;
