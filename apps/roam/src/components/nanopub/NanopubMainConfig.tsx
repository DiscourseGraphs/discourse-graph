import React, { useMemo, useState, useCallback, useRef, memo } from "react";
import { InputGroup, Button, Intent, Label } from "@blueprintjs/core";
import { OnloadArgs, PullBlock } from "roamjs-components/types";
import { getSubTree } from "roamjs-components/util";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";

type NanopubMainConfigProps = {
  onloadArgs: OnloadArgs;
  uid: string;
};
export type PossibleContributor = {
  uid: string;
  name: string;
  orcid: string;
};

const NanopubMainConfig = ({ onloadArgs, uid }: NanopubMainConfigProps) => {
  const [orcid, setOrcid] = useState(
    onloadArgs.extensionAPI.settings.get("orcid") as string
  );
  const tree = useMemo(() => getBasicTreeByParentUid(uid), [uid]);
  const contributorsUid = useMemo<string>(
    () => getSubTree({ tree, key: "contributors", parentUid: uid }).uid,
    [tree, uid]
  );
  const [contributors, setContributors] = useState<PossibleContributor[]>(() =>
    getBasicTreeByParentUid(contributorsUid).map((c) => ({
      uid: c.uid,
      name: c.text,
      orcid: c.children[0]?.text,
    }))
  );
  const userDisplayNames = useMemo(() => {
    const queryResults = window.roamAlphaAPI.data.fast.q(
      `[:find (pull ?p [:user/email]) (pull ?r [:node/title]) :where 
        [?p :user/display-page ?r]
      ]`
    ) as [PullBlock, PullBlock][];

    return queryResults
      .map(([p, r]) => {
        const title = r?.[":node/title"];
        const email = p?.[":user/email"] as string | undefined;

        if (title && title.startsWith("Anonymous") && email) {
          return email;
        }
        return title || email || "";
      })
      .filter(Boolean)
      .filter((name) => name !== "Anonymous");
  }, []);

  const [possibleContributors, setPossibleContributors] = useState<string[]>(
    userDisplayNames.filter(
      (name) => !contributors.some((c) => c.name === name)
    )
  );
  console.log("possibleContributors", possibleContributors);
  const currentUserName = useMemo(() => getCurrentUserDisplayName(), []);

  return (
    <div className="space-y-4">
      <Label>Contributors</Label>
      <div className="space-y-2">
        {contributors.map((contributor, index) => (
          <ContributorRow
            key={contributor.uid}
            contributor={contributor}
            currentUserName={currentUserName}
            setContributors={setContributors}
            setPossibleContributors={setPossibleContributors}
            userDisplayNames={possibleContributors}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          intent={Intent.PRIMARY}
          icon="add"
          onClick={async () =>
            setContributors([
              ...contributors,
              {
                uid: await createBlock({
                  parentUid: contributorsUid,
                  node: { text: "" },
                }),
                name: "",
                orcid: "",
              },
            ])
          }
        >
          Add Contributor
        </Button>
        <Button
          icon="add"
          minimal
          hidden={contributors.some((c) => c.name === currentUserName)}
          onClick={async () => {
            const uid = await createBlock({
              parentUid: contributorsUid,
              node: {
                text: currentUserName,
                children: [{ text: "" }],
              },
            });
            setContributors([
              ...contributors,
              {
                uid,
                name: currentUserName,
                orcid,
              },
            ]);
            const inputElement = document.querySelector(
              `[data-contributor-uid="${uid}"] .orcid-input input`
            ) as HTMLInputElement;
            if (inputElement) {
              inputElement.focus();
              console.log("inputElement", inputElement);
            }
          }}
        >
          Add Yourself as Contributor
        </Button>
      </div>
    </div>
  );
};

const ContributorRow = memo(
  ({
    contributor,
    currentUserName,
    key,
    userDisplayNames,
    setContributors,
    setPossibleContributors,
  }: {
    contributor: PossibleContributor;
    currentUserName: string;
    key: string;
    setContributors: React.Dispatch<
      React.SetStateAction<PossibleContributor[]>
    >;
    setPossibleContributors: React.Dispatch<React.SetStateAction<string[]>>;
    userDisplayNames: string[];
  }) => {
    const debounceRef = useRef(0);

    const setContributorName = useCallback(
      (newName: string) => {
        updateBlock({
          uid: contributor.uid,
          text: newName,
        });
        setContributors((_contributors) =>
          _contributors.map((con) =>
            con.uid === contributor.uid ? { ...con, name: newName } : con
          )
        );
      },
      [contributor.uid, setContributors]
    );
    const setContributorOrcid = useCallback(
      (newOrcid: string) => {
        const orcidUid = getFirstChildUidByBlockUid(contributor.uid);
        if (orcidUid) {
          updateBlock({
            uid: orcidUid,
            text: newOrcid,
          });
        } else {
          createBlock({
            parentUid: contributor.uid,
            node: { text: newOrcid },
          });
        }
        setContributors((_contributors) =>
          _contributors.map((con) =>
            con.uid === contributor.uid ? { ...con, orcid: newOrcid } : con
          )
        );
      },
      [contributor.uid, setContributors]
    );

    const removeContributor = useCallback(() => {
      setContributors((_contributors) =>
        _contributors.filter((c) => c.uid !== contributor.uid)
      );
      deleteBlock(contributor.uid);
    }, [contributor.uid, setContributors]);

    return (
      <div
        key={key}
        className="flex items-center space-x-2"
        data-contributor-uid={contributor.uid}
      >
        <AutocompleteInput
          placeholder="Contributor name"
          value={contributor.name}
          setValue={setContributorName}
          options={userDisplayNames}
          onBlur={(e) => {
            setContributorName(e);
            setPossibleContributors((prev) =>
              prev.filter((name) => name !== e)
            );
          }}
        />
        <InputGroup
          placeholder="0000-0000-0000-0000"
          value={contributor.orcid}
          onChange={(e) => setContributorOrcid(e.target.value)}
          onBlur={(e) => setContributorOrcid(e.target.value)}
          className="font-mono orcid-input"
        />
        <Button icon="cross" minimal onClick={removeContributor} />
        {contributor.name === currentUserName && (
          <div
            className="h-2 w-2 rounded-full bg-green-500"
            title="This is you."
          />
        )}
      </div>
    );
  }
);

export default NanopubMainConfig;
