"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const Page = () => {
  const searchParams = useSearchParams();
  const accessToken = searchParams.get("accessToken");
  const state = searchParams.get("state");
  const [message, setMessage] = useState("Please Wait");

  const hasValidOpener =
    window.opener && !window.opener.closed && searchParams.has("accessToken");
  useEffect(() => {
    const postMessage = () => {
      if (hasValidOpener) window.opener.postMessage(accessToken, "*");

      if (searchParams.has("state")) {
        let attemptAmount = 0;
        const check = () => {
          if (attemptAmount < 30) {
            fetch("/api/access-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ state }),
            })
              .then((r) => r.json())
              .then((r) => {
                if (r?.accessToken) {
                  setMessage("Success! You may close this page.");
                  setTimeout(() => window.close(), 4000);
                } else {
                  attemptAmount++;
                  setTimeout(check, 1000);
                }
              });
          } else {
            setMessage(
              `If you are using the app instead of the browser, please authorize in app. Otherwise please contact discoursegraphs@gmail.com`,
            );
          }
        };
        setTimeout(check, 1500);
      }
    };

    postMessage();
  }, [searchParams]);

  if (searchParams.has("accessToken")) {
    return <div className="text-center">{message}</div>;
  }

  return (
    <div className="text-center">
      Something went wrong. Please contact discoursegraphs@gmail.com.
    </div>
  );
};

export default Page;
