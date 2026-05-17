import { PostHog } from "posthog-node";

let posthog: PostHog | undefined;

const getPostHog = (): PostHog | undefined => {
  if (posthog === undefined) {
    if (
      !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
      !process.env.NEXT_PUBLIC_POSTHOG_HOST
    ) {
      console.error("PostHog environment variables are not set");
      return;
    }
    posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthog;
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
  context?: object;
  forceSendInDev?: boolean;
}): void => {
  if (process.env.NODE_ENV === "development" && forceSendInDev !== true) {
    console.error(error);
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
    const posthog = getPostHog();
    if (posthog)
      posthog.captureException(error, undefined, {
        ...context,
        type: slugType,
      });
    if (process.env.NODE_ENV === "development") console.error(error);
  }
};

export default internalError;
