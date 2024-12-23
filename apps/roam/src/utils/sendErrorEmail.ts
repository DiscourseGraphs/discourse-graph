import { getNodeEnv } from "roamjs-components/util/env";
import { ErrorEmailProps } from "@repo/types";
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
  const payload: ErrorEmailProps = {
    errorMessage: error.message,
    errorStack: error.stack || "",
    type,
    app: "Roam",
    graphName: window.roamAlphaAPI?.graph?.name || "unknown",
    context,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      console.error(`Failed to send error email: ${errorMessage}`);
    }
  } catch (err) {
    console.error(`Error sending request: ${err}`);
  }
};

export default sendErrorEmail;
