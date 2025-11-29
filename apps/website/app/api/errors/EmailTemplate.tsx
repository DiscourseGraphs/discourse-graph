import { ErrorEmailProps } from "@repo/types";
import React from "react";

const ErrorField = ({ label, value }: { label: string; value: string }) => (
  <div>
    <span style={{ fontWeight: "bold", minWidth: "100px" }}>{label}:</span>{" "}
    {value}
  </div>
);
// TODO: use react.email
export const EmailTemplate = ({
  errorMessage,
  errorStack,
  type,
  app,
  graphName,
  version,
  buildDate,
  username,
  context,
}: ErrorEmailProps) => {
  return (
    <div>
      <h1>Error Report</h1>
      <ErrorField label="Type" value={type} />
      <ErrorField label="App" value={app} />
      <ErrorField label="Graph Name" value={graphName} />
      <ErrorField label="Username" value={username} />
      <ErrorField label="Version" value={version} />
      <ErrorField label="Build Date" value={buildDate} />

      <div>
        <h2>Error Details</h2>
        <div>{errorMessage}</div>
      </div>

      {context != null && Object.keys(context).length > 0 && (
        <div>
          <h2>Additional Data</h2>
          <pre>{JSON.stringify(context, null, 2)}</pre>
        </div>
      )}

      {errorStack && (
        <div>
          <h2>Stack Trace</h2>
          <pre>{errorStack}</pre>
        </div>
      )}
    </div>
  );
};
