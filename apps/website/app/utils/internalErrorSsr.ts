import { posthog, type Properties } from "posthog-js";

let initialized = false;

const doInitPostHog = (): void => {
  if (initialized) return;
  if (
    !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    !process.env.NEXT_PUBLIC_POSTHOG_HOST
  ) {
    throw new Error("PostHog environment variables are not set");
  }
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    /* eslint-disable @typescript-eslint/naming-convention */
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: false,
    /* eslint-enable @typescript-eslint/naming-convention */
  });
  initialized = true;
};

const NON_WORD = /\W+/g;
export const internalError = ({
  error,
  type,
  context,
  forceSendInDev = false,
}: {
  error: unknown;
  type?: string;
  context?: Properties;
  forceSendInDev?: boolean;
}): void => {
  if (process.env.NODE_ENV === "development" && forceSendInDev !== true) {
    console.error(error);
  } else {
    doInitPostHog();
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
    if (process.env.NODE_ENV === "development") console.error(error);
  }
};

export default internalError;
