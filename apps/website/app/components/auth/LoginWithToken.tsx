"use client";

import { createClient } from "~/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import internalError from "~/utils/internalError";

export const LoginWithToken = () => {
  const loginAttempted = useRef(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [secretToken] = useState(() => searchParams.get("t"));
  useEffect(() => {
    if (secretToken && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("t");
      window.history.replaceState({}, "", url);
    }
  }, [secretToken]);
  const [url] = useState(searchParams.get("url"));
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(
    secretToken === null ? "Please provide token" : null,
  );

  const login = useCallback(async () => {
    try {
      const client = createClient();
      const result = await client.rpc("get_secret_token", {
        token: secretToken!,
      });
      if (result.error) {
        setError("Could not connect to DiscourseGraphs");
        internalError({ error: result.error, type: "get-secret-token" });
        return;
      }
      if (result.data == null) {
        setError("Could not retrieve information, please try again.");
        internalError({ error: "missing token", type: "get-secret-token" });
        return;
      }
      if (typeof result.data !== "string") {
        setError(
          "DiscourseGraphs configuration error, the team has been warned",
        );
        internalError({
          error: "payload-not-string",
          type: "get-secret-token",
        });
        return;
      }
      const data = JSON.parse(result.data) as {
        /* eslint-disable @typescript-eslint/naming-convention */
        access_token: string;
        refresh_token: string;
        /* eslint-enable @typescript-eslint/naming-convention */
      };
      if (
        !data ||
        typeof data !== "object" ||
        !data.access_token ||
        !data.refresh_token
      ) {
        setError(
          "DiscourseGraphs configuration error, the team has been warned",
        );
        internalError({ error: "misshaped-payload", type: "get-secret-token" });
        return;
      }
      const response = await client.auth.setSession(data);
      if (response.error) {
        setError(response.error.message);
      } else if (url) {
        router.replace(url);
      }
    } catch (error) {
      setError("Unkown error while logging you in.");
      internalError({ error, type: "token-login-exception" });
    } finally {
      setDone(true);
    }
  }, [secretToken, url, router]);
  useEffect(() => {
    if (!error && !done && !loginAttempted.current) {
      loginAttempted.current = true;
      void login();
    }
  }, [error, login, secretToken, done]);
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {error ? "Error: " + error : done ? "Logged in" : "Logging in"}
      </div>
    </div>
  );
};
