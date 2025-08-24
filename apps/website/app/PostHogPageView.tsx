"use client";

import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePostHog, type PostHog } from "posthog-js/react";
import type { FunctionComponent } from "react";

const PostHogPageViewInner = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams, posthog]);

  return null;
};

// Use dynamic import to ensure this only runs on the client
const PostHogPageView = dynamic(() => Promise.resolve(PostHogPageViewInner), {
  ssr: false,
}) as FunctionComponent<{}>;

export default PostHogPageView;
