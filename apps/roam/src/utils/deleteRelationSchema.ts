import deleteBlock from "roamjs-components/writes/deleteBlock";
import {
  getGlobalSettings,
  setGlobalSetting,
} from "~/components/settings/utils/accessors";
import { GLOBAL_KEYS } from "~/components/settings/utils/settingKeys";
import refreshConfigTree from "./refreshConfigTree";
import { markRelationSchemaDeleted } from "./relationSchemaChanges";

export const deleteRelationSchema = async (uid: string): Promise<void> => {
  await deleteBlock(uid);
  markRelationSchemaDeleted(uid);
  const remaining = { ...getGlobalSettings().Relations };
  delete remaining[uid];
  setGlobalSetting([GLOBAL_KEYS.relations], remaining);
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  refreshConfigTree();
};
