"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Props = {
  accessToken?: string;
  state?: string;
};

const Page = ({ accessToken, state }: Props) => {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Please Wait");
  const hasValidOpener = window.opener && !window.opener.closed && accessToken;

  useEffect(() => {
    const postMessage = () => {
      if (hasValidOpener) window.opener.postMessage(accessToken, "*");

      // This will be used when the extension doesn't allow for a popup window to pass a postMessage (eg: electron apps)
      // We are just checking if the db has the access token, client app will have to fetch it themselves.
      if (state) {
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

  if (accessToken) {
    return <div className="text-center">{message}</div>;
  }

  return (
    <div className="text-center">
      Something went wrong. Please contact discoursegraphs@gmail.com.
    </div>
  );
};

export default Page;
