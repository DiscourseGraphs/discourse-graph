import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import { getVersionWithDate } from "./getVersion";
import posthog from "posthog-js";
import type { CaptureResult } from "posthog-js";
import { getSetting } from "./extensionSettings";
import { DISALLOW_DIAGNOSTICS } from "~/data/userSettings";

let initialized = false;

const doInitPostHog = (): void => {
  if (initialized) return;
  const propertyDenylist = new Set([
    "$ip",
    "$device_id",
    "$geoip_city_name",
    "$geoip_latitude",
    "$geoip_longitude",
    "$geoip_postal_code",
    "$geoip_subdivision_1_name",
    "$raw_user_agent",
    "$current_url",
    "$referrer",
    "$referring_domain",
    "$initial_current_url",
    "$pathname",
  ]);
  posthog.init("phc_SNMmBqwNfcEpNduQ41dBUjtGNEUEKAy6jTn63Fzsrax", {
    /* eslint-disable @typescript-eslint/naming-convention  */
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    property_denylist: [...propertyDenylist],
    before_send: (result: CaptureResult | null) => {
      if (result !== null) {
        result.properties = Object.fromEntries(
          Object.entries(result.properties).filter(
            ([k]) => !propertyDenylist.has(k),
          ),
        );
      }
      return result;
    },
    /* eslint-enable @typescript-eslint/naming-convention  */
    autocapture: false,
    loaded: (posthog) => {
      const { version, buildDate } = getVersionWithDate();
      const userUid = getCurrentUserUid();
      const graphName = window.roamAlphaAPI.graph.name;
      posthog.identify(userUid, {
        graphName,
      });
      posthog.register({
        version: version || "-",
        buildDate: buildDate || "-",
        graphName,
      });
      posthog.capture("Extension Loaded");
      initialized = true;
    },
  });
};

export const enablePostHog = (): void => {
  doInitPostHog();
  posthog.opt_in_capturing();
};

export const disablePostHog = (): void => {
  if (initialized) posthog.opt_out_capturing();
};

export const initPostHog = (): void => {
  const disabled = getSetting(DISALLOW_DIAGNOSTICS, false);
  if (!disabled) {
    doInitPostHog();
  }
};
