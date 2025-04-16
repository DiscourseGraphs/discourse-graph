import { getSetting, setRoamJSSetting } from "./settings";
const SETTINGS_TO_MIGRATE = ["selected-repo", "oauth-github"];

const ROAMJS_PREFIXED_SETTINGS = ["discourse-relation-copy"];

/**
 * Migrates settings from localStorage to extension settings API
 * Call this on plugin initialization
 */
export default function migrateSettings(): void {
  // Migrate standard settings
  SETTINGS_TO_MIGRATE.forEach((key) => {
    // getSetting will automatically migrate from localStorage if needed
    getSetting(key);
  });

  // Migrate roamjs: prefixed settings
  ROAMJS_PREFIXED_SETTINGS.forEach((key) => {
    const localKey = `roamjs:${key}`;
    const localValue = localStorage.getItem(localKey);

    if (localValue !== null) {
      try {
        // Try to parse as JSON if possible
        const parsedValue = JSON.parse(localValue);
        setRoamJSSetting(key, parsedValue);
      } catch {
        // If not JSON, store as string
        setRoamJSSetting(key, localValue);
      }

      // Clean up localStorage
      localStorage.removeItem(localKey);
    }
  });

  console.log("Settings migration completed");
}
