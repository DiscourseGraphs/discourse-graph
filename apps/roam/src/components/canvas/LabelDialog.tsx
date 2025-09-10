/* eslint-disable @typescript-eslint/naming-convention */
import React, {
  useRef,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import {
  Button,
  Callout,
  Classes,
  Dialog,
  Intent,
  Spinner,
  SpinnerSize,
  Checkbox,
  Label,
} from "@blueprintjs/core";
import { IconName, IconNames } from "@blueprintjs/icons";
import fireQuery from "~/utils/fireQuery";
import fuzzy from "fuzzy";
import { RoamOverlayProps } from "roamjs-components/util/renderOverlay";
import { Result } from "~/utils/types";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import { DiscourseContextType } from "./Tldraw";
import { getPlainTitleFromSpecification } from "~/utils/getPlainTitleFromSpecification";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";

const LabelDialogAutocomplete = ({
  setLabel,
  setUid,
  nodeType,
  initialUid,
  initialValue,
  onSubmit,
  isCreateCanvasNode,
  referencedNode,
  action,
  format,
  label,
}: {
  setLabel: (text: string) => void;
  setUid: (uid: string) => void;
  nodeType: string;
  initialUid: string;
  initialValue: { text: string; uid: string };
  onSubmit: () => void;
  isCreateCanvasNode: boolean;
  referencedNode: { name: string; nodeType: string } | null;
  action: string;
  format: string;
  label: string;
}) => {
  const requestIdRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<Result[]>([]);
  const [referencedNodeOptions, setReferencedNodeOptions] = useState<Result[]>(
    [],
  );
  const [referencedNodeValue, setReferencedNodeValue] = useState("");
  const [isAddReferencedNode, setAddReferencedNode] = useState(false);
  const [isEditExistingLabel, setIsEditExistingLabel] = useState(false);
  const [content, setContent] = useState(label);
  useEffect(() => {
    let alive = true;
    const req = ++requestIdRef.current;
    setIsLoading(true);
    const fetchOptions = async () => {
      try {
        // Fetch main options
        if (nodeType) {
          const conditionUid = window.roamAlphaAPI.util.generateUID();
          const results = await fireQuery({
            returnNode: "node",
            selections: [],
            conditions: [
              {
                source: "node",
                relation: "is a",
                target: nodeType,
                uid: conditionUid,
                type: "clause",
              },
            ],
          });
          if (requestIdRef.current === req && alive) setOptions(results);
        }

        // Fetch referenced node options if needed
        if (isAddReferencedNode && referencedNode) {
          const conditionUid = window.roamAlphaAPI.util.generateUID();
          const results = await fireQuery({
            returnNode: "node",
            selections: [],
            conditions: [
              {
                source: "node",
                relation: "is a",
                target: referencedNode.nodeType,
                uid: conditionUid,
                type: "clause",
              },
            ],
          });
          if (requestIdRef.current === req && alive) {
            setReferencedNodeOptions(results);
          }
        }
      } catch (error) {
        if (requestIdRef.current === req && alive) {
          console.error("Error fetching options:", error);
        }
      } finally {
        if (requestIdRef.current === req && alive) setIsLoading(false);
      }
    };

    void fetchOptions();
    return () => {
      alive = false;
    };
  }, [nodeType, isAddReferencedNode, referencedNode]);

  const inputDivRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isAddReferencedNode && inputDivRef.current) {
      const inputElement =
        inputDivRef.current.getElementsByTagName("textarea")[0];
      if (inputElement) inputElement.focus();
    }
  }, [isAddReferencedNode, inputDivRef]);

  const setValue = useCallback(
    (r: Result) => {
      // Don't allow selection of disabled items
      if (r.disabled) return;
      
      if (action === "creating" && r.uid === initialUid) {
        // replace when migrating from format to specification
        const pageName = format.replace(/{([\w\d-]*)}/g, (_, val) => {
          if (/content/i.test(val)) return r.text;
          if (
            referencedNode &&
            new RegExp(referencedNode.name, "i").test(val) &&
            isAddReferencedNode
          )
            return referencedNodeValue;
          return "";
        });
        setLabel(pageName);
      } else {
        setLabel(r.text);
      }
      setUid(r.uid);
      setContent(r.text);
    },
    [
      setLabel,
      setUid,
      isAddReferencedNode,
      referencedNode,
      action,
      initialUid,
      format,
      referencedNodeValue,
    ],
  );
  const setValueFromReferencedNode = useCallback(
    (r: Result) => {
      // Don't allow selection of disabled items
      if (r.disabled) return;
      
      if (!referencedNode) return;
      if (action === "editing") {
        // Hack for default shipped EVD format: [[EVD]] - {content} - {Source},
        // replace when migrating from format to specification
        if (content.endsWith(" - ")) {
          setLabel(`${content}[[${r.text}]]`);
        } else if (content.endsWith(" -")) {
          setLabel(`${content} [[${r.text}]]`);
        } else {
          setLabel(`${content} - [[${r.text}]]`);
        }
      } else {
        const pageName = format.replace(/{([\w\d-]*)}/g, (_, val) => {
          if (/content/i.test(val)) return content;
          if (new RegExp(referencedNode.name, "i").test(val))
            return `[[${r.text}]]`;
          return "";
        });
        setLabel(pageName);
      }
      setReferencedNodeValue(r.text);
    },
    [setLabel, referencedNode, content, action, format],
  );
  const onNewItem = useCallback(
    (text: string) => ({ text, uid: initialUid }),
    [initialUid],
  );
  const itemToQuery = useCallback((result?: Result) => result?.text || "", []);
  const filterOptions = useCallback(
    (o: Result[], q: string) => {
      const filtered = fuzzy
        .filter(q, o, { extract: itemToQuery })
        .map((f) => f.original)
        .filter((f): f is Result => !!f);
      
      // Add "No Nodes Exist Yet" disabled item if no options available
      if (o.length === 0) {
        return [{ text: "No Nodes Exist Yet", uid: "", disabled: true }];
      }
      
      return filtered;
    },
    [itemToQuery],
  );

  return (
    <>
      {!isCreateCanvasNode ? (
        <div className="m-6">
          <div className="mb-1 font-semibold">Current Title</div>
          <div>{initialValue.text}</div>
        </div>
      ) : (
        ""
      )}
      {(isAddReferencedNode || isEditExistingLabel || isCreateCanvasNode) && (
        <div className="m-6">
          <div className="mb-1 font-semibold">
            {!isCreateCanvasNode ? "New Title" : "Preview"}
          </div>
          <div>{label}</div>
        </div>
      )}

      <div className="flex items-center justify-between">
        {action === "editing" ? (
          <Checkbox
            label={`Edit`}
            checked={isEditExistingLabel}
            onChange={(e) => {
              const checked = e.target as HTMLInputElement;
              setIsEditExistingLabel(checked.checked);
            }}
            disabled={isAddReferencedNode}
            indeterminate={isAddReferencedNode}
            className={isAddReferencedNode ? "flex-grow" : ""}
          />
        ) : isAddReferencedNode ? (
          <Label className={"flex-grow"}>Title</Label>
        ) : (
          <div className={"flex-grow"}></div>
        )}
        {referencedNode && (
          <Checkbox
            label={`Set ${referencedNode?.name}`}
            checked={isAddReferencedNode}
            onChange={(e) => {
              const checked = e.target as HTMLInputElement;
              setAddReferencedNode(checked.checked);
            }}
            disabled={action === "setting" || isEditExistingLabel}
            indeterminate={action === "setting" || isEditExistingLabel}
          />
        )}
      </div>
      {(isEditExistingLabel || isCreateCanvasNode) && (
        <AutocompleteInput
          value={isCreateCanvasNode ? { text: "", uid: "" } : initialValue}
          setValue={setValue}
          onConfirm={onSubmit}
          options={options}
          multiline
          autoFocus
          onNewItem={onNewItem}
          itemToQuery={itemToQuery}
          filterOptions={filterOptions}
          disabled={
            isLoading ||
            (action === "editing" && !!referencedNode && !isEditExistingLabel)
          }
          placeholder={isLoading ? "Loading ..." : "Enter a label ..."}
          maxItemsDisplayed={100}
        />
      )}
      {isAddReferencedNode &&
        (action === "creating" || action === "editing") && (
          <div className="referenced-node-autocomplete" ref={inputDivRef}>
            <Label>{referencedNode?.name}</Label>
            <AutocompleteInput
              value={
                referencedNodeValue
                  ? { text: referencedNodeValue, uid: "" }
                  : { text: "", uid: "" }
              }
              setValue={setValueFromReferencedNode}
              options={referencedNodeOptions}
              multiline
              onNewItem={onNewItem}
              itemToQuery={itemToQuery}
              filterOptions={filterOptions}
              placeholder={
                isLoading ? "..." : `Enter a ${referencedNode?.name} ...`
              }
              maxItemsDisplayed={100}
            />
          </div>
        )}
    </>
  );
};

type NodeDialogProps = {
  label: string;
  onSuccess: (a: Result) => Promise<void>;
  onCancel: () => void;
  nodeType: string;
  initialUid: string;
  discourseContext: DiscourseContextType;
};

const LabelDialog = ({
  isOpen,
  onClose,
  label: _label,
  onSuccess,
  onCancel,
  nodeType,
  initialUid,
  discourseContext,
}: RoamOverlayProps<NodeDialogProps>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const initialLabel = useMemo(() => {
    if (_label) return _label;
    const { specification, text } = discourseContext.nodes[nodeType];
    if (!specification.length) return "";
    return getPlainTitleFromSpecification({ specification, text });
  }, [_label, nodeType, discourseContext.nodes]);
  const initialValue = useMemo(() => {
    return { text: initialLabel, uid: initialUid };
  }, [initialLabel, initialUid]);
  const [label, setLabel] = useState(initialValue.text);
  const [uid, setUid] = useState(initialValue.uid);
  const [loading, setLoading] = useState(false);
  const isCreateCanvasNode = !isLiveBlock(initialUid);
  const { format } = discourseContext.nodes[nodeType];
  const referencedNode = useMemo(() => {
    const regex = /{([\w\d-]*)}/g;
    const matches = [...format.matchAll(regex)];

    for (const match of matches) {
      const val = match[1];
      if (val.toLowerCase() === "context") continue;

      const referencedNode = Object.values(discourseContext.nodes).find(
        ({ text }) => new RegExp(text, "i").test(val),
      );

      if (referencedNode) {
        return { name: referencedNode.text, nodeType: referencedNode.type };
      }
    }

    return null;
  }, [format, discourseContext.nodes]);

  const renderCalloutText = () => {
    let title = "Please provide a label";
    let icon = IconNames.INFO_SIGN;
    let action = "initial";
    const nodeLabel = discourseContext.nodes[nodeType].text;

    if (!label) return { title, icon, action };

    if (!isCreateCanvasNode) {
      if (uid === initialUid) {
        title = `Edit title of ${nodeLabel} node`;
        icon = IconNames.EDIT;
        action = "editing";
      } else {
        title = `Change to existing ${nodeLabel} node`;
        icon = IconNames.EXCHANGE;
        action = "changing";
      }
    } else {
      if (uid === initialUid) {
        title = `Create new ${nodeLabel} node`;
        icon = IconNames.NEW_OBJECT;
        action = "creating";
      } else {
        title = `Set to existing ${nodeLabel} node`;
        icon = IconNames.LINK;
        action = "setting";
      }
    }

    return { title, icon, action };
  };
  const calloutText = renderCalloutText();

  const onSubmit = () => {
    setLoading(true);
    onSuccess({ text: label, uid, action: calloutText.action })
      .then(onClose)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  const onCancelClick = useCallback(() => {
    onCancel();
    onClose();
  }, [onCancel, onClose]);

  // Listens for touch outside container to trigger close
  const touchRef = useRef<EventTarget | null>();
  useEffect(() => {
    const { current } = containerRef;
    if (!current) return;
    const touchStartListener = (e: TouchEvent) => {
      if ((e.target as HTMLElement)?.closest(".roamjs-autocomplete-input"))
        return;
      touchRef.current = e.target;
    };
    const touchEndListener = (e: TouchEvent) => {
      if (
        touchRef.current === e.target &&
        e.target !== null &&
        !current.contains(e.target as HTMLElement)
      ) {
        onCancelClick();
      }
    };
    document.body.addEventListener("touchstart", touchStartListener);
    document.body.addEventListener("touchend", touchEndListener);
    return () => {
      document.body.removeEventListener("touchstart", touchStartListener);
      document.body.removeEventListener("touchend", touchEndListener);
    };
  }, [containerRef, onCancelClick, touchRef]);

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onCancelClick}
        canOutsideClickClose
        // Escape isn't working?
        canEscapeKeyClose
        autoFocus={false}
        className={"roamjs-canvas-dialog"}
      >
        <div
          // Prevents TLDraw from hijacking onClick and onMouseup
          // https://discord.com/channels/859816885297741824/1209834682384912397
          onPointerDown={(e) => e.stopPropagation()}
          style={{ pointerEvents: "all" }}
        >
          <div className={Classes.DIALOG_BODY} ref={containerRef}>
            <Callout
              intent="primary"
              className="mb-4"
              title={calloutText.title}
              icon={calloutText.icon as IconName}
            />
            <LabelDialogAutocomplete
              setLabel={setLabel}
              setUid={setUid}
              nodeType={nodeType}
              initialUid={initialUid}
              initialValue={initialValue}
              onSubmit={onSubmit}
              isCreateCanvasNode={isCreateCanvasNode}
              action={calloutText.action || ""}
              referencedNode={referencedNode}
              format={format}
              label={label}
            />
          </div>
          <div className={Classes.DIALOG_FOOTER}>
            <div
              className={`${Classes.DIALOG_FOOTER_ACTIONS} flex-row-reverse items-center`}
            >
              <Button
                text={"Confirm"}
                intent={Intent.PRIMARY}
                onClick={onSubmit}
                onTouchEnd={onSubmit}
                disabled={loading || !label}
                className="flex-shrink-0"
              />
              <Button
                text={"Cancel"}
                onClick={onCancelClick}
                onTouchEnd={onCancelClick}
                disabled={loading}
                className="flex-shrink-0"
              />
              <span className={"flex-grow text-red-800"}>{error}</span>
              {loading && <Spinner size={SpinnerSize.SMALL} />}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
};

export default LabelDialog;
