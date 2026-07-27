import React from "react";
import Description from "roamjs-components/components/Description";

type SettingsDescriptionProps = React.ComponentProps<typeof Description>;

const SettingsDescription = (
  props: SettingsDescriptionProps,
): React.ReactElement => <Description {...props} interactionKind="hover" />;

export default SettingsDescription;
