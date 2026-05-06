"use client";

import { createClient } from "~/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

export const LoginWithToken = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [accessToken] = useState(searchParams.get("t"));
  const [refreshToken] = useState(searchParams.get("r"));
  const [url] = useState(searchParams.get("url"));
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(
    accessToken === null ? "Please provide access token" : null,
  );

  const login = useCallback(async () => {
    try {
      const client = createClient();
      const response = await client.auth.setSession({
        /* eslint-disable @typescript-eslint/naming-convention */
        access_token: accessToken!,
        // in most cases, do not provide the refresh token! The access token will expire after 1h
        refresh_token: refreshToken ?? "faketoken",
        /* eslint-enable @typescript-eslint/naming-convention */
      });
      if (response.error) {
        setError(response.error.message);
      } else if (url) {
        router.replace(url);
      }
    } catch (error) {
      setError("error");
    } finally {
      setDone(true);
    }
  }, [accessToken, refreshToken, url, router]);
  useEffect(() => {
    if (!error && !done) {
      void login();
    }
  }, [error, login, accessToken, refreshToken, done]);
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {error ? "Error: " + error : done ? "Logged in" : "Logging in"}
      </div>
    </div>
  );
};
