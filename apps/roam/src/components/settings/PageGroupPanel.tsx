import React, { useState, useCallback } from "react";
import { Label, Button, Intent, Tag } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";

type PageGroupData = {
  uid: string;
  name: string;
  pages: { uid: string; name: string }[];
};

const PageGroupsPanel = ({ uid }: { uid: string }) => {
  const [pageGroups, setPageGroups] = useState<PageGroupData[]>(() =>
    getBasicTreeByParentUid(uid).map((node) => ({
      uid: node.uid,
      name: node.text,
      pages: node.children.map((c) => ({ uid: c.uid, name: c.text })),
    })),
  );

  const refreshGroups = useCallback(() => {
    setPageGroups(
      getBasicTreeByParentUid(uid).map((node) => ({
        uid: node.uid,
        name: node.text,
        pages: node.children.map((c) => ({ uid: c.uid, name: c.text })),
      })),
    );
  }, [uid, setPageGroups]);

  const [newGroupName, setNewGroupName] = useState("");
  const [newPageInputs, setNewPageInputs] = useState<Record<string, string>>(
    {},
  );
  const [autocompleteKeys, setAutocompleteKeys] = useState<
    Record<string, number>
  >({});

  const addGroup = async (name: string) => {
    if (!name || pageGroups.some((g) => g.name === name)) return;
    try {
      await createBlock({ parentUid: uid, node: { text: name } });
      refreshGroups();
      setNewGroupName("");
    } catch (e) {
      console.error("Error adding group", e);
    }
  };

  const removeGroup = async (groupUid: string) => {
    try {
      await deleteBlock(groupUid);
      refreshGroups();
    } catch (e) {
      console.error("Error removing group", e);
    }
  };

  const addPageToGroup = async (groupUid: string, page: string) => {
    const group = pageGroups.find((g) => g.uid === groupUid);
    if (!page || group?.pages.some((p) => p.name === page)) {
      return;
    }
    try {
      await createBlock({ parentUid: groupUid, node: { text: page } });
      refreshGroups();
      setNewPageInputs((prev) => ({
        ...prev,
        [groupUid]: "",
      }));
      setAutocompleteKeys((prev) => ({
        ...prev,
        [groupUid]: (prev[groupUid] || 0) + 1,
      }));
    } catch (e) {
      console.error("Error adding page to group", e);
    }
  };

  const removePageFromGroup = async (pageUid: string) => {
    try {
      await deleteBlock(pageUid);
      refreshGroups();
    } catch (e) {
      console.error("Error removing page from group", e);
    }
  };

  const getPageInput = (groupUid: string) => newPageInputs[groupUid] || "";
  const setPageInput = useCallback((groupUid: string, value: string) => {
    setTimeout(() => {
      setNewPageInputs((prev) => ({
        ...prev,
        [groupUid]: value,
      }));
    }, 0);
  }, []);
  const getAutocompleteKey = (groupUid: string) =>
    autocompleteKeys[groupUid] || 0;

  return (
    <div className="p-4">
      <Label>
        Default Page Groups
        <Description
          description={
            "Organize pages into named groups that will be used by default when generating Discourse Suggestions."
          }
        />
        <div className="flex flex-col gap-2 pl-2">
          {/* Add Group */}
          <div className="flex items-center gap-2">
            <AutocompleteInput
              value={newGroupName}
              setValue={setNewGroupName}
              placeholder="New group name…"
              options={[]}
            />
            <Button
              icon="plus"
              small
              minimal
              disabled={
                !newGroupName || pageGroups.some((g) => g.name === newGroupName)
              }
              onClick={() => addGroup(newGroupName)}
            />
          </div>

          {/* Existing Groups */}
          {Object.keys(pageGroups).length === 0 && (
            <div className="text-sm italic text-gray-500">No groups added.</div>
          )}
          {pageGroups.map((group) => (
            <div key={group.uid} className="rounded border p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">{group.name}</span>
                <Button
                  icon="trash"
                  minimal
                  small
                  intent={Intent.DANGER}
                  onClick={() => removeGroup(group.uid)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex-0 min-w-[160px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && getPageInput(group.uid)) {
                      e.preventDefault();
                      e.stopPropagation();
                      addPageToGroup(group.uid, getPageInput(group.uid));
                    }
                  }}
                >
                  <AutocompleteInput
                    key={getAutocompleteKey(group.uid)}
                    value={getPageInput(group.uid)}
                    placeholder="Add page…"
                    setValue={(v) => setPageInput(group.uid, v)}
                    options={getAllPageNames()}
                    maxItemsDisplayed={50}
                  />
                </div>
                <Button
                  icon="plus"
                  small
                  minimal
                  onClick={async () =>
                    await addPageToGroup(group.uid, getPageInput(group.uid))
                  }
                  disabled={
                    !getPageInput(group.uid) ||
                    group.pages.some((p) => p.name === getPageInput(group.uid))
                  }
                />
              </div>
              {group.pages.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {group.pages.map((p) => (
                    <Tag
                      key={p.uid}
                      onRemove={async () => await removePageFromGroup(p.uid)}
                      round
                      minimal
                    >
                      {p.name}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Label>
    </div>
  );
};

export default PageGroupsPanel;
