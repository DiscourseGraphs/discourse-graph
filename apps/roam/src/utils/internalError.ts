import posthog from "posthog-js";
import type { Properties } from "posthog-js";
import renderToast from "roamjs-components/components/Toast";
import { getVersionWithDate } from "~/utils/getVersion";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";

const internalError = ({
  error,
  userMessage,
  type,
  context,
}: {
  error: unknown;
  type?: string;
  userMessage?: string;
  context?: Properties;
}): void => {
  if (process.env.NODE_ENV === "development") {
    console.error(error, context);
  } else {
    const { version, buildDate } = getVersionWithDate();
    const username = getCurrentUserDisplayName();
    if (username) posthog.identify(username);
    context = {
      app: "Roam",
      type: type || "internal-error",
      graphName: window.roamAlphaAPI?.graph?.name || "unknown",
      version: version || "-",
      buildDate: buildDate || "-",
      ...(context || {}),
    };

    if (typeof error === "string") {
      error = new Error(error);
    } else if (!(error instanceof Error)) {
      try {
        const serialized = JSON.stringify(error);
        error = new Error(serialized);
      } catch {
        error = new Error(typeof error);
      }
    }
    posthog.captureException(error, context);
  }
  if (userMessage !== undefined) {
    renderToast({
      id: `${type || "internal-error"}-${Date.now()}`,
      intent: "danger",
      timeout: 5000,
      content: userMessage,
    });
  }
};

export default internalError;
