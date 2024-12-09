import {
  Button,
  ControlGroup,
  InputGroup,
  Intent,
  HTMLTable,
  Tooltip,
} from "@blueprintjs/core";
import React, { useState } from "react";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import refreshConfigTree from "~/utils/refreshConfigTree";
import createPage from "roamjs-components/writes/createPage";
import type { CustomField } from "roamjs-components/components/ConfigPanels/types";

type DiscourseNodeConfigPanelProps = React.ComponentProps<
  CustomField["options"]["component"]
> & {
  isPopup?: boolean;
  setSelectedTabId: (id: string) => void;
};

const DiscourseNodeConfigPanel: React.FC<DiscourseNodeConfigPanelProps> = ({
  isPopup,
  setSelectedTabId,
}) => {
  const [nodes, setNodes] = useState(() =>
    getDiscourseNodes().filter((n) => n.backedBy === "user"),
  );
  const [label, setLabel] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(
    null,
  );

  const navigateToNode = (uid: string) => {
    if (isPopup) {
      setSelectedTabId(uid);
    } else {
      window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid } });
    }
  };

  return (
    <>
      <ControlGroup className="mb-4 mt-1 flex space-x-2">
        <InputGroup
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={"roamjs-discourse-config-label"}
        />
        <Button
          text={"Add Node"}
          intent={Intent.PRIMARY}
          icon={"plus"}
          className="select-none"
          disabled={!label}
          onClick={() => {
            createPage({
              title: `discourse-graph/nodes/${label}`,
              tree: [
                {
                  text: "Shortcut",
                  children: [{ text: label.slice(0, 1).toUpperCase() }],
                },
                {
                  text: "Format",
                  children: [
                    {
                      text: `[[${label.slice(0, 3).toUpperCase()}]] - {content}`,
                    },
                  ],
                },
              ],
            }).then((valueUid) => {
              setNodes([
                ...nodes,
                {
                  format: "",
                  type: valueUid,
                  text: label,
                  shortcut: "",
                  specification: [],
                  backedBy: "user",
                  canvasSettings: {},
                },
              ]);
              refreshConfigTree();
              setLabel("");
            });
          }}
        />
      </ControlGroup>

      <HTMLTable striped interactive className="w-full cursor-none">
        <thead>
          <tr>
            <th>Node</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <tr key={n.type}>
              <td
                onClick={() => navigateToNode(n.type)}
                style={{ verticalAlign: "middle" }}
              >
                {n.text}
              </td>
              <td>
                <Tooltip content="Edit" hoverOpenDelay={500}>
                  <Button
                    icon="edit"
                    minimal
                    onClick={() => navigateToNode(n.type)}
                  />
                </Tooltip>
                <Tooltip content="Delete" hoverOpenDelay={500}>
                  <Button
                    icon="trash"
                    minimal
                    onClick={() => {
                      if (deleteConfirmation) setDeleteConfirmation(null);
                      else setDeleteConfirmation(n.type);
                    }}
                  />
                </Tooltip>
                <Button
                  children="Confirm"
                  intent={Intent.DANGER}
                  onClick={() => {
                    window.roamAlphaAPI
                      .deletePage({ page: { uid: n.type } })
                      .then(() => {
                        setNodes(nodes.filter((nn) => nn.type !== n.type));
                        refreshConfigTree();
                      });
                  }}
                  className={`mx-1 ${
                    deleteConfirmation !== n.type ? "opacity-0" : ""
                  }`}
                />
                <Button
                  children="Cancel"
                  onClick={() => setDeleteConfirmation(null)}
                  className={`mx-1 ${
                    deleteConfirmation !== n.type ? "opacity-0" : ""
                  }`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </HTMLTable>
    </>
  );
};

export default DiscourseNodeConfigPanel;
