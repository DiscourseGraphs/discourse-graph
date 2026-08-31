import React, { useId } from "react";
import { Icon, type IconName, Position, Tooltip } from "@blueprintjs/core";
import { settingAnchor } from "~/components/settings/utils/settingAnchor";
import { describedSetting } from "~/components/settings/utils/settingsCatalog";
import { withDocsLink } from "~/components/settings/utils/docs";

/**
 * Who a setting applies to. Two values only, matching the agreed badge model:
 * a setting either affects just you or everyone in the graph. Per-node settings
 * are `global` — they are stored on the node type's own page, so the whole graph
 * sees them.
 */
export type SettingScope = "personal" | "global";

const SCOPE_INDICATORS = {
  personal: {
    icon: "person",
    tooltip: "Personal — applies only to you",
  },
  global: {
    icon: "globe",
    tooltip: "Graph-wide — applies to everyone in this graph",
  },
} as const satisfies Record<SettingScope, { icon: IconName; tooltip: string }>;

/**
 * Two Blueprint rules will push this badge out of line if the surrounding
 * markup changes: `label.bp3-label .bp3-popover-wrapper` sets `display: block`
 * and `margin-top: 5px` at specificity (0,2,1), which outranks any utility
 * class, and `.bp3-icon` is `vertical-align: text-bottom`. Both are neutralised
 * here by the label being a raw `<label>` rather than Blueprint's `<Label>`
 * (so the first selector cannot match) and by the flex layout below (which
 * makes `vertical-align` inert). Keep both properties when editing.
 */
const SettingScopeIndicator = ({ scope }: { scope: SettingScope }) => {
  const { icon, tooltip } = SCOPE_INDICATORS[scope];
  return (
    <Tooltip content={tooltip} position={Position.TOP} hoverOpenDelay={300}>
      <span
        aria-label={tooltip}
        className="dg-setting-row__scope flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-500"
      >
        <Icon icon={icon} iconSize={12} />
      </span>
    </Tooltip>
  );
};

type SettingItemRowProps = {
  label: React.ReactNode;
  description?: React.ReactNode;
  /**
   * Given the row's generated id so the control can be associated with the
   * label. Pass a plain node for controls that own their own labelling.
   */
  control: React.ReactNode | ((controlId: string) => React.ReactNode);
  scope?: SettingScope;
  /** `below` is for controls too tall to sit beside the label, such as a textarea. */
  controlPlacement?: "trailing" | "below";
  settingKeys?: string[];
  error?: string;
  /** Tighter row for narrow hosts such as the Export dialog: no scope badge, control below. */
  compact?: boolean;
};

const SettingItemRow = ({
  label,
  description,
  control,
  scope,
  controlPlacement = "trailing",
  settingKeys,
  error,
  compact = false,
}: SettingItemRowProps): React.ReactElement => {
  const controlId = useId();
  const isAssociated = typeof control === "function";
  // The catalog fallback lets a call site drop the prop, so the row and search
  // read one string rather than two that can drift.
  const authored =
    description === undefined ? describedSetting(settingKeys) : undefined;
  const resolvedDescription =
    description ??
    (authored
      ? authored.docsLink
        ? withDocsLink(authored.description, authored.docsLink)
        : authored.description
      : undefined);
  // A raw label keeps Blueprint's `.bp3-label` spacing out of the row, and
  // keeps the description a sibling rather than a descendant — a description
  // nested in the label makes its doc links toggle the control (ENG-2080).
  const LabelTag = isAssociated ? "label" : "div";

  return (
    <div
      {...(settingKeys ? settingAnchor(settingKeys) : {})}
      className={`dg-setting-row ${compact ? "py-2" : "py-3"} ${
        controlPlacement === "trailing" && !compact
          ? "flex items-center justify-between gap-4"
          : "flex flex-col gap-2"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <LabelTag
          {...(isAssociated ? { htmlFor: controlId } : {})}
          className={`dg-setting-row__label mb-0 flex items-center gap-2 font-semibold ${
            isAssociated ? "cursor-pointer" : ""
          }`}
        >
          {scope && !compact ? <SettingScopeIndicator scope={scope} /> : null}
          <span>{label}</span>
        </LabelTag>
        {resolvedDescription ? (
          <div className="text-sm font-normal text-gray-500">
            {resolvedDescription}
          </div>
        ) : null}
        {error ? (
          <div className="text-sm font-medium text-red-600">{error}</div>
        ) : null}
      </div>
      <div
        className={
          controlPlacement === "trailing" && !compact
            ? "flex-shrink-0"
            : "w-full"
        }
      >
        {isAssociated ? control(controlId) : control}
      </div>
    </div>
  );
};

export default SettingItemRow;
