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
    "$referrer",
    "$referring_domain",
  ]);
  /* eslint-disable @typescript-eslint/naming-convention  */
  posthog.init("phc_SNMmBqwNfcEpNduQ41dBUjtGNEUEKAy6jTn63Fzsrax", {
    autocapture: false,
    disable_session_recording: true,
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
    loaded: (posthog) => {
      const { version, buildDate } = getVersionWithDate();
      const userUid = window.roamAlphaAPI.user.uid() || "";
      const graphName = window.roamAlphaAPI.graph.name;
      posthog.identify(userUid);
      posthog.register_for_session({
        version: version || "-",
        buildDate: buildDate || "-",
        graphName,
      });
      posthog.capture("Extension Loaded");
      initialized = true;
    },
  });
  /* eslint-enable @typescript-eslint/naming-convention  */
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
