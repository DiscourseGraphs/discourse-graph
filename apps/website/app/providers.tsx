"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { useEffect } from "react";
import PostHogPageView from "./PostHogPageView";

if (
  !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
  !process.env.NEXT_PUBLIC_POSTHOG_HOST
) {
  throw new Error("PostHog environment variables are not set");
}

export const PostHogProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
      capture_pageview: false,
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
      <Toaster />
    </PHProvider>
  );
};
