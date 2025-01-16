import React, { useState, useEffect } from "react";
import { Alert, Button, Intent, Checkbox, Icon } from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types";
import renderOverlay from "roamjs-components/util/renderOverlay";
import ReactDOM from "react-dom";

type Props = {
    onloadArgs: OnloadArgs;
}

export const ThreeStateSwitch = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
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
  

  export const PosthogEyeController = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
    const { extensionAPI } = onloadArgs;
    const [isRecording, setIsRecording] = useState(false);
    const [container] = useState(() => document.createElement("span"));
  
    useEffect(() => {
      const currentValue = extensionAPI.settings.get("posthog-session-recording");
      setIsRecording(!!currentValue);
    }, [extensionAPI]);
  
    const toggleRecording = () => {
      const newValue = !isRecording;
      setIsRecording(newValue);
      extensionAPI.settings.set("posthog-session-recording", newValue);
    };
  
    useEffect(() => {
      const topbar = document.querySelector(".rm-topbar");
      if (!topbar) return;
  
      // Insert as second to last element
      const lastChild = topbar.lastElementChild;
      if (lastChild) {
        topbar.insertBefore(container, lastChild);
      } else {
        topbar.appendChild(container);
      }
  
      return () => {
        container.remove();
      };
    }, [container]);
  
    return ReactDOM.createPortal(
      <Button
        minimal
        className="rm-posthog-tracker"
        onClick={toggleRecording}
        icon={<Icon icon={isRecording ? "eye-open" : "eye-off"} />}
      />,
      container
    );
  };

export const renderEye = (props: Props) =>
    renderOverlay({
      Overlay: PosthogEyeController,
      props: {
       onloadArgs: props.onloadArgs,
     },
  });
  

export function ShowRecordingPermissionPopup({ onloadArgs }: { onloadArgs: OnloadArgs }) {
    const { extensionAPI } = onloadArgs;
  
    const [isOpen, setIsOpen] = useState(true);
    console.log("isOpen", isOpen);
  
    const handleConfirm = () => {
      extensionAPI.settings.set("posthog-session-recording", true);
      setIsOpen(false);
      renderEye({onloadArgs});
    };
  
    const handleCancel = () => {
      extensionAPI.settings.set("posthog-session-recording", false);
      setIsOpen(false);
      renderEye({onloadArgs});

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
         <h3 className="text-xl font-semibold mb-4">Permission to screen record Roam for a Week?</h3>
        
        <p className="mb-4">
          We would like to <strong>screen record your usage of Roam</strong> for a week. This data will be used <strong>strictly for internal purposes</strong>, such as:
        </p>

        <ul className="list-disc pl-6 mb-4">
          <li>Improving the onboarding process</li>
          <li>Fixing usability issues</li>
          <li>Identifying areas where users need additional guidance</li>
        </ul>

        <p className="mb-4">
          Important points to note:
        </p>

        <ul className="list-disc pl-6 mb-4">
          <li>Your data will <strong>never be shared</strong> with third parties</li>
          <li>Recording will <strong>automatically stop after one week</strong></li>
          <li>You can <strong>opt out anytime</strong> or extend the recording period</li>
          <li>Control recording using the <strong>Eye icon</strong> in the topbar</li>
        </ul>

        <p className="font-medium">Do you grant permission for screen recording?</p>
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



  