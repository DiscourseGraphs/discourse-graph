import { SchemaSelectionPanel } from "~/components/SchemaSelectionPanel";
import type {
  SchemaSelectionSource,
  SchemaSelectionState,
} from "~/components/useSchemaSelection";

type SchemaSelectionModalBodyProps = {
  title: string;
  description: string;
  source: SchemaSelectionSource;
  selection: SchemaSelectionState;
  footerSecondaryLabel: string;
  onFooterSecondaryClick: () => void;
  footerPrimaryLabel: string;
  onFooterPrimaryClick: () => void;
  isFooterPrimaryDisabled?: boolean;
  isFooterSecondaryDisabled?: boolean;
};

export const SchemaSelectionModalBody = ({
  title,
  description,
  source,
  selection,
  footerSecondaryLabel,
  onFooterSecondaryClick,
  footerPrimaryLabel,
  onFooterPrimaryClick,
  isFooterPrimaryDisabled = false,
  isFooterSecondaryDisabled = false,
}: SchemaSelectionModalBodyProps) => {
  return (
    <div>
      <h3 className="mb-2">{title}</h3>
      <p className="text-muted mb-4 text-sm">{description}</p>

      <SchemaSelectionPanel source={source} selection={selection} />

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          className="px-4 py-2"
          onClick={onFooterSecondaryClick}
          disabled={isFooterSecondaryDisabled}
        >
          {footerSecondaryLabel}
        </button>
        <button
          type="button"
          className="!bg-accent !text-on-accent rounded px-4 py-2"
          onClick={onFooterPrimaryClick}
          disabled={isFooterPrimaryDisabled}
        >
          {footerPrimaryLabel}
        </button>
      </div>
    </div>
  );
};
