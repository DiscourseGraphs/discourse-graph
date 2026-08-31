import React, { useId } from "react";
import { Icon, type IconName, Position, Tooltip } from "@blueprintjs/core";
import { settingAnchor } from "~/components/settings/utils/settingAnchor";

/** Who a setting applies to. Populating these is ENG-2187; the row only renders them. */
export type SettingScope = "personal" | "global" | "nodeType";

const SCOPE_INDICATORS = {
  personal: {
    icon: "person",
    tooltip: "Personal — applies only to you",
  },
  global: {
    icon: "globe",
    tooltip: "Graph-wide — applies to everyone in this graph",
  },
  nodeType: {
    icon: "diagram-tree",
    tooltip: "Node type — applies to every node of this type",
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
};

const SettingItemRow = ({
  label,
  description,
  control,
  scope,
  controlPlacement = "trailing",
  settingKeys,
  error,
}: SettingItemRowProps): React.ReactElement => {
  const controlId = useId();
  const isAssociated = typeof control === "function";
  // A raw label keeps Blueprint's `.bp3-label` spacing out of the row, and
  // keeps the description a sibling rather than a descendant — a description
  // nested in the label makes its doc links toggle the control (ENG-2080).
  const LabelTag = isAssociated ? "label" : "div";

  return (
    <div
      {...(settingKeys ? settingAnchor(settingKeys) : {})}
      className={`dg-setting-row py-3 ${
        controlPlacement === "trailing"
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
          {scope ? <SettingScopeIndicator scope={scope} /> : null}
          <span>{label}</span>
        </LabelTag>
        {description ? (
          <div className="text-sm font-normal text-gray-500">{description}</div>
        ) : null}
        {error ? (
          <div className="text-sm font-medium text-red-600">{error}</div>
        ) : null}
      </div>
      <div
        className={controlPlacement === "trailing" ? "flex-shrink-0" : "w-full"}
      >
        {isAssociated ? control(controlId) : control}
      </div>
    </div>
  );
};

export default SettingItemRow;
