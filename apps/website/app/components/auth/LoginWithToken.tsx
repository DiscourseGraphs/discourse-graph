"use client";

import { createClient } from "~/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

export const LoginWithToken = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [secretToken] = useState(searchParams.get("t"));
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
        setError(result.error.message);
        return;
      }
      if (result.data == null) {
        setError("This token does not exist");
        return;
      }
      if (typeof result.data !== "string") {
        setError("Payload is not a string");
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
        setError("Malformed token information");
        return;
      }
      const response = await client.auth.setSession(data);
      if (response.error) {
        setError(response.error.message);
      } else if (url) {
        router.replace(url);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unknown error occurred",
      );
    } finally {
      setDone(true);
    }
  }, [secretToken, url, router]);
  useEffect(() => {
    if (!error && !done) {
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
