import React from "react";
import { InputGroup, type InputGroupProps2 } from "@blueprintjs/core";

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
