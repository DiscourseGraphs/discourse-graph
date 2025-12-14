import posthog from "posthog-js";
import type { Properties } from "posthog-js";
import renderToast from "roamjs-components/components/Toast";
import { getVersionWithDate } from "~/utils/getVersion";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import sendErrorEmail from "~/utils/sendErrorEmail";

const internalError = ({
  error,
  userMessage,
  type,
  context,
  sendEmail, // true by default
}: {
  error: unknown;
  type?: string;
  userMessage?: string;
  context?: Properties;
  sendEmail?: boolean;
}): void => {
  if (process.env.NODE_ENV === "development") {
    console.error(error, context);
  } else {
    const { version, buildDate } = getVersionWithDate();
    const username = getCurrentUserDisplayName();
    if (username) posthog.identify(username);
    type = type || "internal-error";
    context = {
      app: "Roam",
      type,
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
    if (sendEmail !== false) {
      sendErrorEmail({
        // by now error is an Error but TS did not figure it out
        error: error as Error,
        type,
        context,
      }).catch(() => {
        console.error("Could not send error email", error, type, context);
      });
    }
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
