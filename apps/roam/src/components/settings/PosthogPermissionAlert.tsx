import React, { useState, useEffect } from "react";
import { Alert, Intent, Checkbox } from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types";
import renderOverlay from "roamjs-components/util/renderOverlay";

type Props = {
  onloadArgs: OnloadArgs;
};

export const ThreeStateSwitch = ({
  onloadArgs,
}: {
  onloadArgs: OnloadArgs;
}) => {
  const [checked, setChecked] = useState<boolean | "indeterminate">(false);
  const { extensionAPI } = onloadArgs;

  useEffect(() => {
    const currentValue = extensionAPI.settings.get("posthog-session-recording");
    if (currentValue === "indeterminate") {
      setChecked("indeterminate");
    } else {
      setChecked(!!currentValue);
    }
  }, [extensionAPI]);

  const handleChange = () => {
    let newValue: boolean | "indeterminate";
    if (checked === false) {
      newValue = true;
    } else if (checked === true) {
      newValue = "indeterminate";
    } else {
      newValue = false;
    }
    setChecked(newValue);
    extensionAPI.settings.set("posthog-session-recording", newValue);
  };

  return (
    <Checkbox
      checked={checked === true}
      indeterminate={checked === "indeterminate"}
      onChange={handleChange}
    />
  );
};

export function ShowRecordingPermissionPopup({
  onloadArgs,
}: {
  onloadArgs: OnloadArgs;
}) {
  const { extensionAPI } = onloadArgs;

  const [isOpen, setIsOpen] = useState(true);
  console.log("isOpen", isOpen);

  const handleConfirm = () => {
    extensionAPI.settings.set("posthog-session-recording", true);
    setIsOpen(false);
  };

  const handleCancel = () => {
    extensionAPI.settings.set("posthog-session-recording", false);
    setIsOpen(false);
  };

  return (
    <Alert
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      cancelButtonText="No, thanks"
      confirmButtonText="Yes, record my screen"
      canEscapeKeyCancel={false}
      canOutsideClickCancel={false}
      intent={Intent.PRIMARY}
    >
      <h3 className="mb-4 text-xl font-semibold">
        Permission to screen record Roam for a Week?
      </h3>

      <p className="mb-4">
        We would like to <strong>screen record your usage of Roam</strong> for a
        week. This data will be used{" "}
        <strong>strictly for internal purposes</strong>, such as:
      </p>

      <ul className="mb-4 list-disc pl-6">
        <li>Improving the onboarding process</li>
        <li>Fixing usability issues</li>
        <li>Identifying areas where users need additional guidance</li>
      </ul>

      <p className="mb-4">Important points to note:</p>

      <ul className="mb-4 list-disc pl-6">
        <li>
          Your data will <strong>never be shared</strong> with third parties
        </li>
        <li>
          Recording will <strong>automatically stop after one week</strong>
        </li>
      </ul>

      <p className="font-medium">
        Do you grant permission for screen recording?
      </p>
    </Alert>
  );
}

export const render = (props: Props) =>
  renderOverlay({
    Overlay: ShowRecordingPermissionPopup,
    props: {
      onloadArgs: props.onloadArgs,
    },
  });
