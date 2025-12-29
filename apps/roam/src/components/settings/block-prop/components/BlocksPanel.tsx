import React, { useRef, useEffect } from "react";
import { Label, Button, Tooltip } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";

type Props = {
  title: string;
  description: string;
  uid: string;
};

export const BlocksPanel = ({ title, description, uid }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && uid) {
      window.roamAlphaAPI.ui.components.renderBlock({
        uid,
        el: containerRef.current,
      });
    }
  }, [uid]);

  if (!uid) {
    return (
      <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
        Block not initialized. Please reload the extension.
      </div>
    );
  }

  return (
    <>
      <Label>
        {title}
        <Description description={description} />
        <Tooltip content="Click here to edit these blocks directly">
          <Button
            icon="link"
            minimal
            onClick={() =>
              window.roamAlphaAPI.ui.mainWindow.openBlock({
                block: { uid },
              })
            }
          />
        </Tooltip>
      </Label>
      <style>
        {`.roamjs-config-blocks > div > .rm-block-main {
          display: none;
        }
        .roamjs-config-blocks > div > .rm-block-children > .rm-multibar {
          display: none;
        }
        .roamjs-config-blocks > div > .rm-block-children {
          margin-left: -4px;
        }`}
      </style>
      <div
        ref={containerRef}
        style={{
          border: "1px solid #33333333",
          padding: "8px 0",
          borderRadius: 4,
        }}
        className="roamjs-config-blocks"
      />
    </>
  );
};
