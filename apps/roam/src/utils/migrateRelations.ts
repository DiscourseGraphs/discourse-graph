import getRelationData from "./getRelationData";
import getBlockProps from "./getBlockProps";
import type { json } from "./getBlockProps";
import setBlockProps from "./setBlockProps";
import { getSetting, setSetting } from "./extensionSettings";
import { USE_REIFIED_RELATIONS } from "~/data/userSettings";
import {
  createReifiedRelation,
  DISCOURSE_GRAPH_PROP_NAME,
} from "./createReifiedBlock";

const MIGRATION_PROP_NAME = "relation-migration";

const migrateRelations = async (dryRun = false): Promise<number> => {
  const authorized = getSetting<boolean>(USE_REIFIED_RELATIONS, false);
  if (!authorized) return 0;
  let numProcessed = 0;
  await setSetting(USE_REIFIED_RELATIONS, false); // so queries use patterns
  // wait for the settings to propagate
  await new Promise((resolve) => setTimeout(resolve, 150));
  try {
    const processed = new Set<string>();
    const relationData = await getRelationData(true);
    for (const rel of relationData) {
      const key = `${rel.source}:${rel.relUid}:${rel.target}`;
      if (processed.has(key)) continue;
      processed.add(key);
      if (!dryRun) {
        const uid = (await createReifiedRelation({
          sourceUid: rel.source,
          destinationUid: rel.target,
          relationBlockUid: rel.relUid,
        }))!;
        const sourceProps = getBlockProps(rel.source);
        const dgDataOrig = sourceProps[DISCOURSE_GRAPH_PROP_NAME];
        const dgData: Record<string, json> =
          dgDataOrig !== null &&
          typeof dgDataOrig === "object" &&
          !Array.isArray(dgDataOrig)
            ? dgDataOrig
            : {};
        const migrationDataOrig = dgData[MIGRATION_PROP_NAME];
        let migrationData: Record<string, json> =
          migrationDataOrig !== null &&
          typeof migrationDataOrig === "object" &&
          !Array.isArray(migrationDataOrig)
            ? migrationDataOrig
            : {};
        if (migrationData[uid] !== undefined) {
          console.debug(`reprocessed ${key}`);
        }
        // clean up old migration entries
        migrationData = Object.fromEntries(
          Object.entries(migrationData).filter(
            ([uid]) =>
              window.roamAlphaAPI.q(
                `[:find ?p :where [?p :block/uid "${uid}"]]`,
              ).length > 0,
          ),
        );
        migrationData[uid] = new Date().valueOf();
        dgData[MIGRATION_PROP_NAME] = migrationData;
        setBlockProps(rel.source, { [DISCOURSE_GRAPH_PROP_NAME]: dgData });
      }
      numProcessed++;
    }
  } finally {
    await setSetting(USE_REIFIED_RELATIONS, true);
  }
  return numProcessed;
};

export default migrateRelations;
