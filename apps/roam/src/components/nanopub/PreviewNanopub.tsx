import React, { useEffect, useState } from "react";
import { creditRoles, getCurrentUserOrcid } from "./ContributorManager";
import {
  Contributor,
  NanopubTriple,
  updateObjectPlaceholders,
} from "./Nanopub";
import { NanopubTripleType } from "./NanopubNodeConfig";
import { DiscourseNode } from "../../utils/getDiscourseNodes";
import { OnloadArgs } from "roamjs-components/types";
import { Text, Button } from "@blueprintjs/core";

const PreviewNanopub = ({
  contributors,
  source,
  templateTriples,
  discourseNode,
  extensionAPI,
  pageUid,
}: {
  contributors?: Contributor[];
  source?: string;
  templateTriples?: NanopubTripleType[];
  discourseNode: DiscourseNode;
  extensionAPI: OnloadArgs["extensionAPI"];
  pageUid: string;
}) => {
  const [resolvedTriples, setResolvedTriples] = useState<NanopubTripleType[]>(
    []
  );

  const groupTriplesByType = () => {
    const grouped = {
      assertion: resolvedTriples?.filter((t) => t.type === "assertion") || [],
      provenance: resolvedTriples?.filter((t) => t.type === "provenance") || [],
      publicationInfo:
        resolvedTriples?.filter((t) => t.type === "publication info") || [],
    };

    // Add source to provenance
    if (source) {
      grouped.provenance.push({
        type: "provenance",
        predicate: "has source",
        object: source,
        uid: "source-triple",
      });
    }

    // Add contributors to publication info
    if (contributors?.length) {
      const contributorTriples = contributors.flatMap((contributor) =>
        contributor.roles
          .map((role) => {
            const creditRole = creditRoles.find((r) => r.label === role);
            if (!creditRole) return null;
            return {
              type: "publication info",
              predicate: creditRole.verb,
              object: contributor.name,
              uid: `${contributor.id}-${creditRole.uri}`,
            };
          })
          .filter((triple): triple is NanopubTripleType => triple !== undefined)
      );
      grouped.publicationInfo.push(...contributorTriples);
    }

    return grouped;
  };

  useEffect(() => {
    const orcid = getCurrentUserOrcid();
    const resolveTriples = async () => {
      const resolved = await Promise.all(
        templateTriples?.map(async (triple) => {
          const updatedObject = await updateObjectPlaceholders({
            object: triple.object,
            pageUid,
            nanopubConfig: discourseNode.nanopub,
            extensionAPI,
            orcid,
          });
          return { ...triple, object: updatedObject };
        }) || []
      );
      setResolvedTriples(resolved);
    };
    resolveTriples();
  }, [templateTriples]);

  const uniqueTypes = Array.from(
    new Set(resolvedTriples?.map((triple) => triple.type) || [])
  );
  const [previewDescription, setPreviewDescription] = useState("");

  if (previewDescription) {
    return (
      <div>
        <Button
          onClick={() => setPreviewDescription("")}
          icon={"arrow-left"}
          text={"Back"}
          className="mb-4"
          outlined
        />
        <div dangerouslySetInnerHTML={{ __html: previewDescription }} />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        {Object.entries(groupTriplesByType()).map(([type, triples]) => (
          <div key={type}>
            <h3 className="text-lg font-semibold capitalize mb-2">{type}</h3>
            {triples.map((triple) => {
              // Handle HTML description case
              const isHtmlDescription =
                triple.type === "assertion" &&
                triple.predicate === "has the description" &&
                triple.object.startsWith("<body>");

              if (isHtmlDescription) {
                return (
                  <div className="grid grid-cols-12 gap-4 border-0 border-b sm:border-b-0 py-2">
                    <Text
                      className="col-span-12 sm:col-span-2 truncate"
                      title={discourseNode?.text || ""}
                      children={discourseNode?.text || ""}
                    />
                    <Text
                      className="col-span-12 sm:col-span-2 truncate"
                      title={triple.predicate}
                      children={triple.predicate}
                    />
                    <div className="col-span-12 sm:col-span-3">
                      <Button
                        outlined
                        small
                        text={"View"}
                        onClick={() => setPreviewDescription(triple.object)}
                      />
                    </div>
                  </div>
                );
              }

              return (
                <NanopubTriple
                  key={triple.uid}
                  subject={discourseNode?.text || ""}
                  predicate={triple.predicate}
                  object={triple.object}
                />
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
};

export default PreviewNanopub;
