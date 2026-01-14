import { execSync } from "child_process";

export const posthog = (version?: string) => {
  process.env.POSTHOG_CLI_HOST =
    process.env.POSTHOG_CLI_HOST ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST ||
    "https://us.posthog.com";
  process.env.POSTHOG_CLI_TOKEN =
    process.env.POSTHOG_CLI_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const { POSTHOG_CLI_ENV_ID, POSTHOG_CLI_TOKEN } = process.env;
  if (POSTHOG_CLI_ENV_ID === undefined)
    throw new Error("Missing posthog variable: POSTHOG_CLI_ENV_ID");
  if (POSTHOG_CLI_TOKEN === undefined)
    throw new Error("Missing posthog variable: POSTHOG_CLI_TOKEN");
  const args = [
    "sourcemap",
    "inject",
    "--directory",
    "dist",
    "--project",
    "Roam",
  ];
  if (version !== undefined) {
    args.push("--version", version.replace(/"/g, '\\"'));
  }
  execSync(`posthog-cli ${args.join(" ")}`, {
    stdio: "inherit",
  });
};
