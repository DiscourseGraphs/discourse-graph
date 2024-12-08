import { Button, InputGroup } from "@blueprintjs/core";
import React, { useState } from "react";
import type { OnloadArgs } from "roamjs-components/types";

export const getQueryPages = (extensionAPI: OnloadArgs["extensionAPI"]) => {
  const value = extensionAPI.settings.get("query-pages") as
    | string[]
    | string
    | Record<string, string>;
  return typeof value === "string"
    ? [value]
    : Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null
    ? Object.keys(value)
    : ["queries/*"];
};

const QueryPagesPanel = ({
  extensionAPI,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const [texts, setTexts] = useState(() => getQueryPages(extensionAPI));
  const [value, setValue] = useState("");
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
            extensionAPI.settings.set("query-pages", newTexts);
            setValue("");
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
              extensionAPI.settings.set("query-pages", newTexts);
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default QueryPagesPanel;
