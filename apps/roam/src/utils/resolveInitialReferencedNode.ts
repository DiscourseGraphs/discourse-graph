import type { PullBlock } from "roamjs-components/types";
import compileDatalog from "./compileDatalog";
import discourseNodeFormatToDatalog from "./discourseNodeFormatToDatalog";
import type { DiscourseNode } from "./getDiscourseNodes";
import type { Result } from "./types";

export const resolveInitialReferencedNode = async ({
  blockUid,
  referencedNodeType,
}: {
  blockUid?: string;
  referencedNodeType: DiscourseNode | null;
}): Promise<Result | undefined> => {
  if (!blockUid || !referencedNodeType) return undefined;

  try {
    const referenced = (
      await window.roamAlphaAPI.data.async.fast.q(
        `[:find (pull ?r [:node/title :block/string :block/uid]) :where [?b :block/uid "${blockUid}"] (or-join [?b ?r] (and [?b :block/parents ?p] [?p :block/refs ?r]) (and [?b :block/page ?r])) ${discourseNodeFormatToDatalog(
          {
            freeVar: "r",
            ...referencedNodeType,
          },
        )
          .map((clause) => compileDatalog(clause, 0))
          .join(" ")}]`,
      )
    )?.[0]?.[0] as PullBlock | undefined;

    const text =
      referenced?.[":node/title"] || referenced?.[":block/string"] || "";
    if (!text) return undefined;

    return {
      text,
      uid: referenced?.[":block/uid"] || "",
    };
  } catch (error) {
    console.error("Error getting initial referenced node:", error);
    return undefined;
  }
};
