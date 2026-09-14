import getBlockProps from "~/utils/getBlockProps";
import { setBlockPropsAsync } from "~/utils/setBlockProps";
import internalError from "~/utils/internalError";
import { invalidateDiscourseNodeTypeCaches } from "~/utils/discourseNodeTypeCache";
import { FEATURE_FLAG_KEYS } from "./settingKeys";
import { STATIC_TOP_LEVEL_ENTRIES } from "./zodSchema";

const LOG_PREFIX = "[DG Props Default Migration]";
export const PROPS_STORE_DEFAULT_MIGRATION_KEY =
  "Props settings default migrated";

export const migratePropsStoreDefault = async (
  blockUids: Record<string, string>,
): Promise<void> => {
  const featureFlagsUid = blockUids[STATIC_TOP_LEVEL_ENTRIES.featureFlags.key];

  if (!featureFlagsUid) {
    internalError({
      error: "Cannot enable props-based settings by default",
      type: "DG Props Default Migration",
      context: { featureFlagsUid },
      sendEmail: false,
    });
    return;
  }

  try {
    const featureFlags = getBlockProps(featureFlagsUid);
    if (featureFlags[PROPS_STORE_DEFAULT_MIGRATION_KEY] === true) {
      console.log(`${LOG_PREFIX} skipped (already migrated)`);
      return;
    }

    const propsStoreAlreadyEnabled =
      featureFlags[FEATURE_FLAG_KEYS.useNewSettingsStore] === true;
    await setBlockPropsAsync(
      featureFlagsUid,
      {
        [PROPS_STORE_DEFAULT_MIGRATION_KEY]: true,
        ...(propsStoreAlreadyEnabled
          ? {}
          : { [FEATURE_FLAG_KEYS.useNewSettingsStore]: true }),
      },
      false,
    );

    if (!propsStoreAlreadyEnabled) {
      invalidateDiscourseNodeTypeCaches();
    }
    console.log(`${LOG_PREFIX} completed`);
  } catch (error) {
    internalError({
      error,
      type: "DG Props Default Migration",
      context: { featureFlagsUid },
      sendEmail: false,
    });
  }
};
