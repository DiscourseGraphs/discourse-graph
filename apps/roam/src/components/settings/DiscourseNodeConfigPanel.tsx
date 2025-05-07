import {
  Alert,
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
import posthog from "posthog-js";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import { deleteBlock } from "roamjs-components/writes";

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

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertConfirmAction, setAlertConfirmAction] = useState<
    () => Promise<void>
  >(() => Promise.resolve());

  const navigateToNode = (uid: string) => {
    if (isPopup) {
      setSelectedTabId(uid);
    } else {
      window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid } });
    }
  };

  const handleDeleteNodeTypeWithConfirmation = (
    nodeTypeIdToDelete: string,
    nodeLabel: string,
  ) => {
    const affectedRelations = getDiscourseRelations().filter(
      (r) =>
        r.source === nodeTypeIdToDelete || r.destination === nodeTypeIdToDelete,
    );

    let dialogMessage = `Are you sure you want to delete the Node Type "${nodeLabel}"?`;

    if (affectedRelations.length > 0) {
      dialogMessage = `The Node Type "${nodeLabel}" is used by the following relations, which will also be deleted:\n\n${affectedRelations
        .map((r) => {
          const sourceNodeDetails = nodes.find((s) => s.type === r.source);
          const destinationNodeDetails = nodes.find(
            (d) => d.type === r.destination,
          );
          return `- ${sourceNodeDetails?.text || r.source} ${r.label} ${destinationNodeDetails?.text || r.destination}`;
        })
        .join("\n")}\n\nProceed with deletion?`;
    }

    setAlertMessage(dialogMessage);
    setAlertConfirmAction(() => async () => {
      try {
        for (const rel of affectedRelations) {
          await deleteBlock(rel.id).catch((error) => {
            console.error(
              `Failed to delete relation: ${rel.id}, ${error.message}`,
            );
            throw error;
          });
        }
        await window.roamAlphaAPI.deletePage({
          page: { uid: nodeTypeIdToDelete },
        });

        setNodes((prevNodes) =>
          prevNodes.filter((nn) => nn.type !== nodeTypeIdToDelete),
        );
        refreshConfigTree();
        setDeleteConfirmation(null);
      } catch (error) {
        console.error(
          `Failed to complete deletion for Node Type ${nodeLabel} (UID: ${nodeTypeIdToDelete}): ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsAlertOpen(false);
      }
    });
    setIsAlertOpen(true);
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
            posthog.capture("Discourse Node: Type Created", { label: label });
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
                      if (deleteConfirmation === n.type) {
                        setDeleteConfirmation(null);
                      } else {
                        setDeleteConfirmation(n.type);
                      }
                    }}
                  />
                </Tooltip>
                <Button
                  children="Confirm"
                  intent={Intent.DANGER}
                  onClick={() => {
                    handleDeleteNodeTypeWithConfirmation(n.type, n.text);
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

      <Alert
        isOpen={isAlertOpen}
        onConfirm={async () => {
          if (alertConfirmAction) {
            await alertConfirmAction();
          }
        }}
        onCancel={() => {
          setIsAlertOpen(false);
          setDeleteConfirmation(null);
        }}
        intent={Intent.DANGER}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        canEscapeKeyCancel={true}
        canOutsideClickCancel={true}
      >
        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {alertMessage}
        </div>
      </Alert>
    </>
  );
};

export default DiscourseNodeConfigPanel;
