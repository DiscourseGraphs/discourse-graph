"use client";

import { useCallback } from "react";
import type { Properties } from "posthog-js";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";

const NON_WORD = /\W+/g;
export const useInternalError = () => {
  const posthog = usePostHog();
  return useCallback(
    ({
      error,
      type,
      userMessage,
      context,
      forceSendInDev = false,
    }: {
      error: unknown;
      type?: string;
      userMessage?: string;
      context?: Properties;
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
        posthog.captureException(error, { ...context, type: slugType });
      }
      if (userMessage) {
        toast(userMessage, { duration: 5000 });
      }
    },
    [posthog],
  );
};

export default useInternalError;
