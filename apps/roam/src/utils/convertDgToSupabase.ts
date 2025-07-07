import {
  discourseNodeSchemaToLocalConcept,
  discourseNodeBlockToLocalConcept,
  discourseRelationSchemaToLocalConcept,
} from "./conceptConversion";
import getDiscourseNodes from "./getDiscourseNodes";
import getDiscourseRelations from "./getDiscourseRelations";
import { getSupabaseContext } from "./supabaseContext";
import { getAllDiscourseNodesSince } from "./getAllDiscourseNodesSince";
import getDiscourseRelationTriples from "./getDiscourseRelationTriples";

export const convertDgToSupabase = async () => {
  const nodes = getDiscourseNodes().filter((n) => n.backedBy === "user");
  const context = await getSupabaseContext();
  if (!context) {
    console.error("Could not get Supabase context. Aborting update.");
    return;
  }
  const nodesTypesToLocalConcepts = nodes.map((node) => {
    const localConcept = discourseNodeSchemaToLocalConcept(context, node);
    return localConcept;
  });
  console.log("nodesTypesToLocalConcepts", nodesTypesToLocalConcepts);

  const relationSchemas = getDiscourseRelations();
  console.log("relationSchemas", relationSchemas);

  const relationsToEmbed = relationSchemas.map((relation) => {
    const localConcept = discourseRelationSchemaToLocalConcept(
      context,
      relation,
    );
    return localConcept;
  });
  console.log("relationsToEmbed", relationsToEmbed);

  const nodesSince = await getAllDiscourseNodesSince("2025-01-01T00:00:00Z");
  console.log("nodesSince", nodesSince);

  const nodeBlockToLocalConcepts = nodesSince.map((node) => {
    const localConcept = discourseNodeBlockToLocalConcept(context, {
      nodeUid: node.source_local_id,
      schemaUid: node.type,
      text: node.text,
    });
    return localConcept;
  });
  console.log("nodeBlockToLocalConcepts", nodeBlockToLocalConcepts);

  const relationTriples = getDiscourseRelationTriples();
  console.log("relationTriples", relationTriples);

  return [
    ...nodesTypesToLocalConcepts,
    ...relationsToEmbed,
    ...nodeBlockToLocalConcepts,
  ];
};
