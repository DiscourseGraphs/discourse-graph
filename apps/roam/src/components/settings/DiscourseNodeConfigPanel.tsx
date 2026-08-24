import {
  Alert,
  Button,
  ControlGroup,
  Icon,
  InputGroup,
  Intent,
  HTMLTable,
  Tooltip,
} from "@blueprintjs/core";
import React, { useMemo, useState } from "react";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import refreshConfigTree from "~/utils/refreshConfigTree";
import createPage from "roamjs-components/writes/createPage";
import type { CustomField } from "roamjs-components/components/ConfigPanels/types";
import posthog from "posthog-js";
import getDiscourseRelations, {
  type DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import { deleteBlock } from "roamjs-components/writes";
import { formatHexColor } from "./DiscourseNodeCanvasSettings";
import setBlockProps from "~/utils/setBlockProps";
import { DiscourseNodeSchema } from "./utils/zodSchema";
import { getGlobalSettings, setGlobalSetting } from "./utils/accessors";
import { GLOBAL_KEYS } from "./utils/settingKeys";
import { invalidateDiscourseNodeTypeCaches } from "~/utils/discourseNodeTypeCache";

type DiscourseNodeConfigPanelProps = React.ComponentProps<
  CustomField["options"]["component"]
> & {
  isPopup?: boolean;
  setSelectedTabId: (id: string) => void;
};

const getFirstAvailableShortcut = (
  label: string,
  takenShortcuts: Set<string>,
): string => {
  for (const char of label.toUpperCase()) {
    if (/[A-Z0-9]/.test(char) && !takenShortcuts.has(char)) {
      return char;
    }
  }
  return "";
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
  const [affectedRelations, setAffectedRelations] = useState<
    DiscourseRelation[]
  >([]);
  const [nodeTypeIdToDelete, setNodeTypeIdToDelete] = useState<string>("");
  const duplicateShortcuts = useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach((n) => {
      const shortcut = n.shortcut.toUpperCase();
      if (!shortcut) return;
      counts.set(shortcut, (counts.get(shortcut) ?? 0) + 1);
    });
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([shortcut]) => shortcut),
    );
  }, [nodes]);
  const navigateToNode = (uid: string) => {
    if (isPopup) {
      setSelectedTabId(uid);
    } else {
      window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid } });
    }
  };

  const deleteNodeType = async (uid: string) => {
    await window.roamAlphaAPI.deletePage({
      page: { uid },
    });
    invalidateDiscourseNodeTypeCaches();
    setNodes((prevNodes) => prevNodes.filter((nn) => nn.type !== uid));
    refreshConfigTree();
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
          text={"Add node"}
          intent={Intent.PRIMARY}
          icon={"plus"}
          className="select-none"
          disabled={!label}
          onClick={() => {
            const takenShortcuts = new Set(
              getDiscourseNodes()
                .map((n) => n.shortcut.toUpperCase())
                .filter(Boolean),
            );
            const shortcut = getFirstAvailableShortcut(label, takenShortcuts);
            const format = `[[${label.slice(0, 3).toUpperCase()}]] - {content}`;
            posthog.capture("Discourse Node: Type Created", { label: label });
            void createPage({
              title: `discourse-graph/nodes/${label}`,
              tree: [
                {
                  text: "Shortcut",
                  children: [{ text: shortcut }],
                },
                {
                  text: "Tag",
                  children: [{ text: "" }],
                },
                {
                  text: "Format",
                  children: [{ text: format }],
                },
              ],
            }).then((valueUid) => {
              setBlockProps(
                valueUid,
                DiscourseNodeSchema.parse({
                  text: label,
                  type: valueUid,
                  shortcut,
                  format,
                }),
              );
              invalidateDiscourseNodeTypeCaches();
              setNodes([
                ...nodes,
                {
                  format: "",
                  type: valueUid,
                  text: label,
                  shortcut,
                  tag: "",
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
            <th>Shortcut</th>
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
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor:
                        formatHexColor(n.canvasSettings?.color) || "#000",
                    }}
                  />
                  <span>{n.text}</span>
                </div>
              </td>
              <td
                onClick={() => navigateToNode(n.type)}
                style={{ verticalAlign: "middle" }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono">{n.shortcut}</span>
                  {duplicateShortcuts.has(n.shortcut.toUpperCase()) && (
                    <Tooltip
                      content={`Multiple nodes share the shortcut "${n.shortcut.toUpperCase()}". Only one of them will respond in the node menu.`}
                    >
                      <Icon icon="warning-sign" intent={Intent.WARNING} />
                    </Tooltip>
                  )}
                </div>
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

                    let dialogMessage = `Are you sure you want to delete the node type "${n.text}"?`;

                    if (affectedRelations.length > 0) {
                      dialogMessage = `The node type "${n.text}" is used by the following relations, which will also be deleted:\n\n${affectedRelations
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
                      deleteNodeType(n.type);
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
        onConfirm={async () => {
          if (affectedRelations.length > 0) {
            try {
              for (const rel of affectedRelations) {
                await deleteBlock(rel.id).catch((error) => {
                  console.error(
                    `Failed to delete relation: ${rel.id}, ${error.message}`,
                  );
                  throw error;
                });
              }
              const relations = { ...getGlobalSettings().Relations };
              for (const rel of affectedRelations) delete relations[rel.id];
              setGlobalSetting([GLOBAL_KEYS.relations], relations);
              deleteNodeType(nodeTypeIdToDelete);
            } catch (error) {
              console.error(
                `Failed to complete deletion for UID: ${nodeTypeIdToDelete}): ${error instanceof Error ? error.message : String(error)}`,
              );
            } finally {
              setIsAlertOpen(false);
            }
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
