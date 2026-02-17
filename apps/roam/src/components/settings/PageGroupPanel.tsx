import React, { useState, useCallback } from "react";
import { Label, Button, Intent, Tag, InputGroup } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { type PageGroup } from "~/utils/getSuggestiveModeConfigSettings";
import { setGlobalSetting } from "~/components/settings/utils/accessors";

const syncPageGroupsToBlockProps = (groups: PageGroup[]) => {
  setGlobalSetting(
    ["Suggestive mode", "Page groups"],
    groups.map((g) => ({ name: g.name, pages: g.pages.map((p) => p.name) })),
  );
};

const PageGroupsPanel = ({
  uid,
  initialGroups,
}: {
  uid: string;
  initialGroups: PageGroup[];
}) => {
  const [pageGroups, setPageGroups] = useState<PageGroup[]>(initialGroups);
  const [newGroupName, setNewGroupName] = useState("");
  const [newPageInputs, setNewPageInputs] = useState<Record<string, string>>(
    {},
  );
  const [autocompleteKeys, setAutocompleteKeys] = useState<
    Record<string, number>
  >({});
  const [groupKey, setGroupKeys] = useState(0);

  const addGroup = async (name: string) => {
    if (!name || pageGroups.some((g) => g.name === name)) return;
    try {
      const newGroupUid = await createBlock({
        parentUid: uid,
        node: { text: name },
      });
      const updatedGroups = [
        ...pageGroups,
        { uid: newGroupUid, name, pages: [] },
      ];
      setPageGroups(updatedGroups);
      syncPageGroupsToBlockProps(updatedGroups);
      setNewGroupName("");
      setGroupKeys((prev) => prev + 1);
    } catch (e) {
      console.error("Error adding group", e);
    }
  };

  const removeGroup = async (groupUid: string) => {
    try {
      await deleteBlock(groupUid);
      const updatedGroups = pageGroups.filter((g) => g.uid !== groupUid);
      setPageGroups(updatedGroups);
      syncPageGroupsToBlockProps(updatedGroups);
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
      const newPageUid = await createBlock({
        parentUid: groupUid,
        node: { text: page },
      });
      const updatedGroups = pageGroups.map((g) =>
        g.uid === groupUid
          ? { ...g, pages: [...g.pages, { uid: newPageUid, name: page }] }
          : g,
      );
      setPageGroups(updatedGroups);
      syncPageGroupsToBlockProps(updatedGroups);
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

  const removePageFromGroup = async (groupUid: string, pageUid: string) => {
    try {
      await deleteBlock(pageUid);
      const updatedGroups = pageGroups.map((g) =>
        g.uid === groupUid
          ? { ...g, pages: g.pages.filter((p) => p.uid !== pageUid) }
          : g,
      );
      setPageGroups(updatedGroups);
      syncPageGroupsToBlockProps(updatedGroups);
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

  const handleNewGroupNameChange = useCallback((value: string) => {
    setNewGroupName(value);
  }, []);

  return (
    <Label>
      Page groups
      <Description
        description={
          "Organize pages into named groups that will be can be selected when generating discourse suggestions."
        }
      />
      <div className="flex flex-col gap-2">
        <div
          className="flex items-baseline gap-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newGroupName) {
              e.preventDefault();
              e.stopPropagation();
              void addGroup(newGroupName);
            }
          }}
        >
          <InputGroup
            key={groupKey}
            value={newGroupName}
            onChange={(e) => handleNewGroupNameChange(e.target.value)}
            placeholder="Page group name"
          />
          <Button
            icon="plus"
            small
            minimal
            disabled={
              !newGroupName || pageGroups.some((g) => g.name === newGroupName)
            }
            onClick={() => void addGroup(newGroupName)}
          />
        </div>

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
                onClick={() => void removeGroup(group.uid)}
              />
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <div
                className="flex-0 min-w-[160px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && getPageInput(group.uid)) {
                    e.preventDefault();
                    e.stopPropagation();
                    void addPageToGroup(group.uid, getPageInput(group.uid));
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
                onClick={() =>
                  void addPageToGroup(group.uid, getPageInput(group.uid))
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
                    onRemove={() => void removePageFromGroup(group.uid, p.uid)}
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
  );
};

export default PageGroupsPanel;
