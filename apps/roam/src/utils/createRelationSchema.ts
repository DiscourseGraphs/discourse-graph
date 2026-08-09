import discourseConfigRef from "~/utils/discourseConfigRef";
import createBlock from "roamjs-components/writes/createBlock";

export const createRelationSchema = async ({
  label,
  complement,
  source,
  destination,
}: {
  label: string;
  complement: string;
  source: string;
  destination: string;
}) => {
  const grammarNode = discourseConfigRef.tree.find(
    (node) => node.text === "grammar",
  );
  const relationsNode = grammarNode?.children.find(
    (node) => node.text === "relations",
  );
  if (!relationsNode) throw new Error("Cannot find the relation grammar");
  return await createBlock({
    parentUid: relationsNode.uid,
    order: "last",
    node: {
      text: label,
      children: [
        {
          text: "source",
          children: [{ text: source }],
        },
        {
          text: "destination",
          children: [{ text: destination }],
        },
        {
          text: "complement",
          children: [{ text: complement }],
        },
      ],
    },
  });
};
