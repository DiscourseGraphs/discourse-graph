import React, { useCallback, useMemo, useRef, useEffect, memo } from "react";
import { Button, Intent } from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { PullBlock } from "roamjs-components/types";
import nanoid from "nanoid";
import { Contributor, NanopubPage } from "./Nanopub";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getSubTree from "roamjs-components/util/getSubTree";
import { PossibleContributor } from "./NanopubMainConfig";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";

// https://credit.niso.org/ taxonomy roles

export type CreditRole = {
  label: string;
  uri: string;
  verb: string;
};
export const creditRoles: CreditRole[] = [
  {
    uri: "conceptualization",
    label: "Conceptualization",
    verb: "Conceptualized by",
  },
  {
    uri: "data-curation",
    label: "Data curation",
    verb: "Data curated by",
  },
  {
    uri: "formal-analysis",
    label: "Formal analysis",
    verb: "Formal analysis performed by",
  },
  {
    uri: "funding-acquisition",
    label: "Funding acquisition",
    verb: "Funding acquired by",
  },
  {
    uri: "investigation",
    label: "Investigation",
    verb: "Investigated by",
  },
  {
    uri: "methodology",
    label: "Methodology",
    verb: "Methodology developed by",
  },
  {
    uri: "project-administration",
    label: "Project administration",
    verb: "Project administered by",
  },
  {
    uri: "software",
    label: "Software",
    verb: "Software developed by",
  },
  {
    uri: "resources",
    label: "Resources",
    verb: "Resources provided by",
  },
  {
    uri: "supervision",
    label: "Supervision",
    verb: "Supervised by",
  },
  {
    uri: "validation",
    label: "Validation",
    verb: "Validated by",
  },
  {
    uri: "visualization",
    label: "Visualization",
    verb: "Visualization created by",
  },
  {
    uri: "writing-original-draft",
    label: "Writing – original draft",
    verb: "Original draft written by",
  },
  {
    uri: "writing-review-editing",
    label: "Writing – review & editing",
    verb: "Reviewed and edited by",
  },
];

export const getContributors = (): PossibleContributor[] => {
  const discourseConfigUid = getPageUidByPageTitle("roam/js/discourse-graph");
  const tree = getBasicTreeByParentUid(discourseConfigUid);
  const nanoPubTree = getSubTree({ tree, key: "Nanopub" });
  if (!nanoPubTree.children.length) return [];
  const contributorsNode = getSubTree({
    tree: nanoPubTree.children,
    key: "contributors",
  });
  return contributorsNode.children
    .map((c) => ({
      uid: c.uid,
      name: c.text,
      orcid: c.children[0]?.text,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const getCurrentUserOrcid = (): string => {
  const contributors = getContributors();
  const name = getCurrentUserDisplayName();
  const contributor = contributors.find((c) => c.name === name);
  return contributor?.orcid || "";
};

const ContributorManager = ({
  pageUid,
  pageProps: props,
  node,
  contributors,
  setContributors,
  requireContributors = false,
  handleClose,
}: {
  pageUid: string;
  pageProps: Record<string, unknown>;
  node: string;
  contributors: Contributor[];
  setContributors: React.Dispatch<React.SetStateAction<Contributor[]>>;
  requireContributors?: boolean;
  handleClose: () => void;
}) => {
  const debounceRef = useRef(0);
  const nanopubProps = props["nanopub"] as NanopubPage;
  const possibleContributorNames = useMemo<PossibleContributor[]>(() => {
    const definedContributors = getContributors() || [];
    return definedContributors.filter(
      (c) => !contributors.some((existing) => existing.name === c.name),
    );
  }, [contributors]);

  const updateContributorProps = useCallback(
    (newContributors: Contributor[]) => {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        window.roamAlphaAPI.updateBlock({
          block: {
            uid: pageUid,
            props: {
              ...props,
              nanopub: { ...nanopubProps, contributors: newContributors },
            },
          },
        });
      }, 1000);
    },
    [pageUid, props, nanopubProps],
  );
  useEffect(() => {
    updateContributorProps(contributors);
  }, [contributors, updateContributorProps]);

  return (
    <>
      <style>
        {`
          .contributor-name-select span.bp3-popover-target,
          .contributor-name-select span.bp3-popover-target button.bp3-button {
            width: 100%;
          }
        `}
      </style>
      <div className="space-y-4">
        <div className="space-y-2">
          {contributors.map((contributor, index) => (
            <ContributorRow
              key={contributor.id}
              contributor={contributor}
              // isEditing={isEditing}
              setContributors={setContributors}
              possibleContributors={possibleContributorNames}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            intent={Intent.PRIMARY}
            icon="add"
            onClick={() =>
              setContributors([
                ...contributors,
                { id: nanoid(), name: "", orcid: "", roles: [] },
              ])
            }
          >
            Add Contributor
          </Button>
          {requireContributors && contributors.length === 0 ? (
            <span className="text-warning">(required)</span>
          ) : contributors.length === 0 ? (
            <span className="text-muted">(optional)</span>
          ) : null}
        </div>
      </div>
    </>
  );
};

const ContributorRow = memo(
  ({
    contributor,
    key,
    // isEditing,
    possibleContributors,
    setContributors,
  }: {
    contributor: Contributor;
    key: string;
    // isEditing: boolean;
    setContributors: React.Dispatch<React.SetStateAction<Contributor[]>>;
    possibleContributors: PossibleContributor[];
  }) => {
    const debounceRef = useRef(0);
    const setContributor = useCallback(
      (newName: string, timeout: boolean = true) => {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(
          () => {
            // this is susceptible to duplicate names
            const newOrcid =
              possibleContributors.find((c) => c.name === newName)?.orcid || "";
            setContributors((_contributors) =>
              _contributors.map((con) =>
                con.id === contributor.id
                  ? { ...con, name: newName, orcid: newOrcid }
                  : con,
              ),
            );
          },
          timeout ? 250 : 0,
        );
      },
      [contributor.id, setContributors],
    );

    const setContributorRoles = useCallback(
      (v: string, contributorParam: Contributor, remove = false) => {
        setContributors((_contributors) =>
          _contributors.map((c) =>
            contributorParam.id === c.id
              ? {
                  ...c,
                  roles: remove
                    ? c.roles?.filter((r) => r !== v)
                    : [...(c.roles || []), v],
                }
              : c,
          ),
        );
      },
      [setContributors],
    );

    const removeContributor = useCallback(() => {
      setContributors((_contributors) =>
        _contributors.filter((c) => c.id !== contributor.id),
      );
    }, [contributor.id, setContributors]);

    return (
      <div key={key} className="flex items-center space-x-2">
        <div className="w-80">
          <MenuItemSelect
            emptyValueText="Contributor Name"
            items={possibleContributors.map((c) => c.name)}
            onItemSelect={(item, event) => {
              console.log(event);
              setContributor(item);
            }}
            filterable={true}
            activeItem={contributor.name}
            className="contributor-name-select"
          />
        </div>
        <MultiSelect
          fill={true}
          items={creditRoles.map((role) => role.label)}
          selectedItems={contributor.roles}
          onItemSelect={(item) => setContributorRoles(item, contributor)}
          tagRenderer={(item) => item}
          popoverProps={{ minimal: true }}
          itemListRenderer={({ items, renderItem }) => {
            return <div className="rounded p-1">{items.map(renderItem)}</div>;
          }}
          itemRenderer={(item, { modifiers, handleClick }) => {
            if (contributor.roles?.includes(item)) return null;
            if (!modifiers.matchesPredicate) return null;
            return (
              <Button
                minimal
                active={modifiers.active}
                onClick={handleClick}
                text={item}
                key={item}
                className="block w-full"
              />
            );
          }}
          tagInputProps={{
            onRemove: (item) =>
              setContributorRoles(item as string, contributor, true),
            placeholder: "Click to add role(s)",
          }}
        />
        <Button icon="cross" minimal onClick={removeContributor} />
      </div>
    );
  },
);

ContributorRow.displayName = "ContributorRow";

export default ContributorManager;
