import React from "react";
import { Checkbox } from "@blueprintjs/core";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";
import DiscourseNodeQueryEditor from "./components/DiscourseNodeQueryEditor";
import {
  getDiscourseNodeSetting,
  setDiscourseNodeSetting,
} from "./utils/accessors";
import type { Condition } from "~/utils/types";

const generateUID = (): string =>
  window.roamAlphaAPI?.util?.generateUID?.() ??
  Math.random().toString(36).substring(2, 11);

const NodeSpecification = ({
  node,
}: {
  node: ReturnType<typeof getDiscourseNodes>[number];
}) => {
  const nodeType = node.type;

  const [enabled, setEnabled] = React.useState(() => {
    const spec = getDiscourseNodeSetting<Condition[]>(nodeType, [
      "specification",
    ]);
    return spec !== null && spec !== undefined && spec.length > 0;
  });

  const createInitialCondition = React.useCallback((): Condition => {
    return {
      uid: generateUID(),
      type: "clause",
      source: node.text,
      relation: "has title",
      target: `/${getDiscourseNodeFormatExpression(node.format).source}/`,
    };
  }, [node.text, node.format]);

  const handleEnabledChange = React.useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const flag = (e.target as HTMLInputElement).checked;
      setEnabled(flag);

      if (flag) {
        // Create initial condition when enabling
        const existingSpec = getDiscourseNodeSetting<Condition[]>(nodeType, [
          "specification",
        ]);
        if (!existingSpec || existingSpec.length === 0) {
          const initialCondition = createInitialCondition();
          setDiscourseNodeSetting(nodeType, ["specification"], [
            initialCondition,
          ]);
        }
      } else {
        // Clear specification when disabling
        setDiscourseNodeSetting(nodeType, ["specification"], []);
      }
    },
    [nodeType, createInitialCondition],
  );

  return (
    <div className={"roamjs-node-specification"}>
      <style>
        {`.roamjs-node-specification .bp3-button.bp3-intent-primary { display: none; }`}
      </style>
      <p>
        <Checkbox
          checked={enabled}
          className={"ml-8 inline-block"}
          onChange={handleEnabledChange}
        />
      </p>
      <div
        className={`${enabled ? "" : "bg-gray-200 opacity-75 pointer-events-none"} overflow-auto`}
      >
        <DiscourseNodeQueryEditor
          nodeType={nodeType}
          defaultConditions={enabled ? [createInitialCondition()] : []}
          key={String(enabled)}
        />
      </div>
    </div>
  );
};

export default NodeSpecification;
