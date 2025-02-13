import React, { useState, useEffect } from "react";
import { Switch, FormGroup, Classes } from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types";

export function AsyncQuerySettings({
  extensionApi,
}: {
  extensionApi: OnloadArgs["extensionAPI"];
}) {
  const [isEnabled, setIsEnabled] = useState(false);

  // Load initial state from settings
  useEffect(() => {
    try {
      const savedSetting = extensionApi.settings.get("async-q");
      setIsEnabled(!!savedSetting);
    } catch (error) {
      console.error("Failed to load async query setting:", error);
      setIsEnabled(false);
    }
  }, []);

  const handleToggle = async (event: React.FormEvent<HTMLInputElement>) => {
    const newValue = event.currentTarget.checked;
    // Update state first
    setIsEnabled(newValue);
    try {
      extensionApi.settings.set("async-q", newValue);
    } catch (error) {
      console.error("Failed to save async query setting:", error);
      setIsEnabled(!newValue);
    }
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
