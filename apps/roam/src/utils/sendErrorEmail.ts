import { getNodeEnv } from "roamjs-components/util/env";
import { ErrorEmailProps } from "@repo/types";
import { getVersionWithDate } from "~/utils/getVersion";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";

const sendErrorEmail = async ({
  error,
  type,
  context,
}: {
  error: Error;
  type: string;
  context?: Record<string, unknown>;
}) => {
  const url =
    getNodeEnv() === "development"
      ? "http://localhost:3000/api/errors"
      : "https://discoursegraphs.com/api/errors";
  const { version, buildDate } = getVersionWithDate();
  const username = getCurrentUserDisplayName();

  const payload: ErrorEmailProps = {
    errorMessage: error.message,
    errorStack: error.stack || "",
    type,
    app: "Roam",
    graphName: window.roamAlphaAPI?.graph?.name || "unknown",
    version: version || "-",
    buildDate: buildDate || "-",
    username: username || "unknown",
    context,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      console.error(`Failed to send error email: ${errorMessage}`);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Error sending request: ${errorMessage}`);
  }
};

export default sendErrorEmail;
