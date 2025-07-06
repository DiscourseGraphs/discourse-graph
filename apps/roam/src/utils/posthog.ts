import posthog from "posthog-js";

/**
 * Wrapper for PostHog capture that only sends events in production
 * @param eventName - The name of the event to capture
 * @param properties - Optional properties to send with the event
 */
export const captureEvent = (eventName: string, properties?: Record<string, any>) => {
  if (process.env.NODE_ENV === "production") {
    posthog.capture(eventName, properties);
  }
};

/**
 * Wrapper for PostHog identify that only runs in production
 * @param distinctId - The distinct ID to identify the user
 * @param properties - Optional properties to set for the user
 */
export const identifyUser = (distinctId: string, properties?: Record<string, any>) => {
  if (process.env.NODE_ENV === "production") {
    posthog.identify(distinctId, properties);
  }
};

/**
 * Initialize PostHog only in production
 */
export const initPostHog = () => {
  if (process.env.NODE_ENV === "production") {
    posthog.init("phc_SNMmBqwNfcEpNduQ41dBUjtGNEUEKAy6jTn63Fzsrax", {
      api_host: "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false,
      autocapture: false,
      property_denylist: [
        "$ip", // Still seeing ip in the event
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
  }
};