import React, { useState, useEffect } from "react";
import { Switch, FormGroup, Classes } from "@blueprintjs/core";
import getExtensionApi from "roamjs-components/util/extensionApiContext";

export function AsyncQuerySettings() {
  const [isEnabled, setIsEnabled] = useState(false);
  const extensionApi = getExtensionApi();

  // Load initial state from settings
  useEffect(() => {
    const savedSetting = extensionApi.settings.get("async-q");
    setIsEnabled(!!savedSetting);
  }, []);

  const handleToggle = async (event: React.FormEvent<HTMLInputElement>) => {
    const newValue = event.currentTarget.checked;
    // Update state first
    setIsEnabled(newValue);
    // Then update settings
    extensionApi.settings.set("async-q", newValue);
  };

  return (
    <div className="p-4">
      <FormGroup
        helperText="This will use Roam's Backend Query. It helps prevent the UI from freezing during large queries but is still in beta and may occasionally produce inaccurate results."
        className={Classes.RUNNING_TEXT}
      >
        <Switch
          checked={isEnabled}
          onChange={handleToggle}
          label="Use Backend Query (Beta)"
          className={Classes.LARGE}
        />
      </FormGroup>
    </div>
  );
}
