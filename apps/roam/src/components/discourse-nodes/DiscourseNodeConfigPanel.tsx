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
import type { CustomField } from "roamjs-components/components/ConfigPanels/types";
import posthog from "posthog-js";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import { deleteBlock } from "roamjs-components/writes";
import { createDiscourseNodePage } from "~/components/settings/block-prop/utils/init";
import { getAllDiscourseNodes } from "~/components/settings/block-prop/utils/accessors";

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
    getAllDiscourseNodes().filter((n) => n.backedBy === "user"),
  );
  const [label, setLabel] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(
    null,
  );

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [affectedRelations, setAffectedRelations] = useState<any[]>([]);
  const [nodeTypeIdToDelete, setNodeTypeIdToDelete] = useState<string>("");
  const navigateToNode = (uid: string) => {
    if (isPopup) {
      setSelectedTabId(uid);
    } else {
      void window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid } });
    }
  };

  const deleteNodeType = async (uid: string) => {
    await window.roamAlphaAPI.deletePage({
      page: { uid },
    });
    setNodes((prevNodes) => prevNodes.filter((nn) => nn.type !== uid));
    setDeleteConfirmation(null);
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

            const defaultFormat = `[[${label.slice(0, 3).toUpperCase()}]] - {content}`;
            const defaultShortcut = label.slice(0, 1).toUpperCase();

            void createDiscourseNodePage(label, {
              format: defaultFormat,
              shortcut: defaultShortcut,
            }).then(({ pageUid }) => {
              setNodes([
                ...nodes,
                {
                  format: defaultFormat,
                  type: pageUid,
                  text: label,
                  shortcut: defaultShortcut,
                  tag: "",
                  specification: [],
                  backedBy: "user",
                  canvasSettings: {},
                } as unknown as ReturnType<typeof getAllDiscourseNodes>[number],
              ]);
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
                  intent={Intent.DANGER}
                  onClick={() => {
                    const affectedRelations = getDiscourseRelations().filter(
                      (r) => r.source === n.type || r.destination === n.type,
                    );

                    let dialogMessage = `Are you sure you want to delete the Node Type "${n.text}"?`;

                    if (affectedRelations.length > 0) {
                      dialogMessage = `The Node Type "${n.text}" is used by the following relations, which will also be deleted:\n\n${affectedRelations
                        .map((r) => {
                          const sourceNodeDetails = nodes.find(
                            (s) => s.type === r.source,
                          );
                          const destinationNodeDetails = nodes.find(
                            (d) => d.type === r.destination,
                          );
                          return `- ${sourceNodeDetails?.text || r.source} ${r.label} ${destinationNodeDetails?.text || r.destination}`;
                        })
                        .join("\n")}\n\nProceed with deletion?`;
                      setIsAlertOpen(true);
                      setAlertMessage(dialogMessage);
                      setAffectedRelations(affectedRelations);
                      setNodeTypeIdToDelete(n.type);
                    } else {
                      void deleteNodeType(n.type);
                    }
                  }}
                  className={`mx-1 ${
                    deleteConfirmation !== n.type ? "opacity-0" : ""
                  }`}
                >
                  Confirm
                </Button>
                <Button
                  onClick={() => setDeleteConfirmation(null)}
                  className={`mx-1 ${
                    deleteConfirmation !== n.type ? "opacity-0" : ""
                  }`}
                >
                  Cancel
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </HTMLTable>

      <Alert
        isOpen={isAlertOpen}
        onConfirm={() => {
          if (affectedRelations.length > 0) {
            void (async () => {
              try {
                for (const rel of affectedRelations) {
                  await deleteBlock(rel.id).catch((error) => {
                    console.error(
                      `Failed to delete relation: ${rel.id}, ${error.message}`,
                    );
                    throw error;
                  });
                }
                void deleteNodeType(nodeTypeIdToDelete);
              } catch (error) {
                console.error(
                  `Failed to complete deletion for UID: ${nodeTypeIdToDelete}): ${error instanceof Error ? error.message : String(error)}`,
                );
              } finally {
                setIsAlertOpen(false);
              }
            })();
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
