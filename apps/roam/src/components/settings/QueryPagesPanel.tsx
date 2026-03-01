import { Button, InputGroup } from "@blueprintjs/core";
import posthog from "posthog-js";
import React, { useState } from "react";
import type { OnloadArgs } from "roamjs-components/types";
import {
  getPersonalSetting,
  setPersonalSetting,
} from "~/components/settings/utils/accessors";

export const getQueryPages = (): string[] => {
  return (
    getPersonalSetting<string[]>(["Query", "Query pages"]) ?? ["queries/*"]
  );
};

const QueryPagesPanel = ({
  extensionAPI,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const [texts, setTexts] = useState(() => getQueryPages());
  const [value, setValue] = useState("");
  const setQueryPages = (newTexts: string[]) => {
    setPersonalSetting(["Query", "Query pages"], newTexts);
    void extensionAPI.settings.set("query-pages", newTexts);
  };

  return (
    <div
      className="flex flex-col"
      style={{
        width: "100%",
        minWidth: 256,
      }}
    >
      <div className={"flex gap-2"}>
        <InputGroup
          style={{ minWidth: "initial" }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          icon={"plus"}
          minimal
          disabled={!value}
          onClick={() => {
            const newTexts = [...texts, value];
            setTexts(newTexts);
            setQueryPages(newTexts);
            setValue("");
            posthog.capture("Query Page: Page Format Added", {
              newType: value,
            });
          }}
        />
      </div>
      {texts.map((p, index) => (
        <div key={index} className="flex items-center justify-between">
          <span
            style={{
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {p}
          </span>
          <Button
            icon={"trash"}
            minimal
            onClick={() => {
              const newTexts = texts.filter((_, jndex) => index !== jndex);
              setTexts(newTexts);
              setQueryPages(newTexts);
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default QueryPagesPanel;
