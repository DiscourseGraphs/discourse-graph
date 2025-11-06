import getRelationData from "./getRelationData";
import { createReifiedRelation } from "./createReifiedBlock";

const migrateRelations = async () => {
  const relationData = await getRelationData();
  // Sequential is slower, but parallel runs in rate limiting issues
  // Also likely to create duplicates!
  // console.log(`Found ${relationData.length} relations`);
  // const created = new Set();
  for (const rel of relationData) {
    const uid = await createReifiedRelation({
      sourceUid: rel.source,
      destinationUid: rel.target,
      relationBlockUid: rel.relUid,
    });
    // created.add(uid);
  }
  // console.log(`Created ${created.size} distinct relations`);
};

export default migrateRelations;
