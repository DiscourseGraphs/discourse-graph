/* eslint-disable @typescript-eslint/naming-convention */
import { z } from "zod";

const DecapOAuthEnvSchema = z.object({
  DECAP_GITHUB_CLIENT_ID: z.string().min(1),
  DECAP_GITHUB_CLIENT_SECRET: z.string().min(1),
  DECAP_OAUTH_BASE_URL: z.string().url().optional(),
});

type DecapOAuthEnv = z.infer<typeof DecapOAuthEnvSchema>;

export const DECAP_STATE_COOKIE_NAME = "decap_oauth_state";
export const DECAP_GITHUB_PROVIDER = "github";

const trimTrailingSlash = (value: string): string =>
  value.endsWith("/") ? value.slice(0, -1) : value;

export const getDecapOAuthEnv = (): DecapOAuthEnv =>
  DecapOAuthEnvSchema.parse(process.env);

export const resolveDecapBaseUrl = (fallbackOrigin?: string): string => {
  const { DECAP_OAUTH_BASE_URL } = getDecapOAuthEnv();
  const baseUrl = DECAP_OAUTH_BASE_URL ?? fallbackOrigin;

  if (!baseUrl) {
    throw new Error("Missing DECAP_OAUTH_BASE_URL and request origin.");
  }

  return trimTrailingSlash(baseUrl);
};

export const buildDecapCallbackUrl = (fallbackOrigin?: string): string =>
  `${resolveDecapBaseUrl(fallbackOrigin)}/callback`;
