import React from "react";
import { InputGroup, type InputGroupProps2 } from "@blueprintjs/core";

/**
 * Trailing control for a setting whose value is a single trigger character or
 * key combo. Presentational only, so the existing trigger and shortcut inputs
 * keep owning their capture behaviour. Use Blueprint's own `inputRef` to reach
 * the underlying input.
 */
const SettingKeycapInput = ({
  wide = false,
  className = "",
  ...props
}: InputGroupProps2 & { wide?: boolean }): React.ReactElement => (
  <InputGroup
    {...props}
    className={`dg-setting-keycap ${wide ? "w-40" : "w-16"} ${className}`}
  />
);

export default SettingKeycapInput;
