import posthog from "posthog-js";
import type { Properties } from "posthog-js";
import renderToast from "roamjs-components/components/Toast";
import sendErrorEmail from "~/utils/sendErrorEmail";
import { getSetting } from "~/utils/extensionSettings";
import { DISALLOW_DIAGNOSTICS } from "~/data/userSettings";

const NON_WORD = /\W+/g;

const internalError = ({
  error,
  userMessage,
  type,
  context,
  sendEmail = true,
  forceSendInDev = false,
}: {
  error: unknown;
  type?: string;
  userMessage?: string;
  context?: Properties;
  sendEmail?: boolean;
  forceSendInDev?: boolean;
}): void => {
  if (
    getSetting(DISALLOW_DIAGNOSTICS, false) ||
    (process.env.NODE_ENV === "development" && forceSendInDev !== true)
  ) {
    console.error(error, context);
  } else {
    type = type || "Internal Error";
    const slugType = type.replaceAll(NON_WORD, "-").toLowerCase();
    context = {
      type,
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
    posthog.captureException(error, { ...context, type: slugType });
    if (sendEmail !== false) {
      sendErrorEmail({
        // by now error is an Error but TS did not figure it out
        error: error as Error,
        type,
        context,
      }).catch((sendError) => {
        console.error(
          "Could not send error email",
          sendError,
          error,
          type,
          context,
        );
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
