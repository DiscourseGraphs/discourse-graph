import posthog from "posthog-js";

export const initPostHog = (sessionRecording: boolean) => {
  console.info("init posthog, record session?", sessionRecording);
  posthog.init("phc_SNMmBqwNfcEpNduQ41dBUjtGNEUEKAy6jTn63Fzsrax", {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    autocapture: false,
    disable_session_recording: sessionRecording,
    property_denylist: [
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
    ],
  });
};
