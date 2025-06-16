"use client";

import React, { useEffect, useState } from "react";

type Props = {
  accessToken?: string;
  state?: string;
  error?: string;
};

const Page = ({ accessToken, state, error }: Props) => {
  const [message, setMessage] = useState(error || "Please Wait");
  const hasValidOpener = window.opener && !window.opener.closed;

  // TODO: check if this is needed, seems to error, but also works
  // useEffect(() => {
  //   // Check for window and opener only after component mounts
  //   setHasValidOpener(Boolean(window?.opener && !window?.opener?.closed));
  //   console.log("hasValidOpener", hasValidOpener);
  // }, []);

  useEffect(() => {
    const postMessage = async () => {
      if (hasValidOpener && accessToken) {
        window.opener.postMessage(accessToken, "*");
        setMessage("Success! You may close this page.");
        // setTimeout(() => window.close(), 2000);
        return;
      }

      // Fallback for apps that don't support popup windows
      // if (state) {
      //   console.log("if state");
      //   let attemptAmount = 0;
      //   const check = async () => {
      //     if (attemptAmount >= 30) {
      //       setMessage(
      //         "If you are using the app instead of the browser, please authorize in app. Otherwise please contact discoursegraphs@gmail.com",
      //       );
      //       return;
      //     }

      //     try {
      //       const response = await fetch("/api/access-token", {
      //         method: "POST",
      //         headers: { "Content-Type": "application/json" },
      //         body: JSON.stringify({ state }),
      //       });

      //       const data = await response.json();
      //       if (data?.accessToken) {
      //         setMessage("Success! You may close this page.");
      //         console.log("window close, state, access token");
      //         // setTimeout(() => window.close(), 2000);
      //         return;
      //       }

      //       attemptAmount++;
      //       setTimeout(check, 1000);
      //     } catch (err) {
      //       console.error("Error checking access token:", err);
      //       attemptAmount++;
      //       setTimeout(check, 1000);
      //     }
      //   };

      //   setTimeout(check, 1500);
      // }
    };
    postMessage();
  }, [accessToken, state, hasValidOpener]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">{message}</div>
      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={() => {
            window.opener?.postMessage(accessToken, "*");
          }}
          className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        >
          *
        </button>

        <button
          onClick={() => {
            window.opener?.postMessage(accessToken, window.location.origin);
          }}
          className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        >
          window.location.origin
        </button>

        <button
          onClick={() => {
            window.opener?.postMessage(
              accessToken,
              process.env.NEXT_PUBLIC_URL,
            );
          }}
          className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        >
          process.env.NEXT_PUBLIC_URL
        </button>
      </div>
    </div>
  );
};

export default Page;
