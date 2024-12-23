import { ErrorEmailProps } from "@repo/types";
import React from "react";

// TODO: use react.email
export const EmailTemplate = ({
  errorMessage,
  errorStack,
  type,
  app,
  graphName,
  context,
}: ErrorEmailProps) => {
  return (
    <div>
      <h1>Error Report</h1>

      <h2>Type: {type}</h2>
      <h2>App: {app}</h2>
      <h2>Graph Name: {graphName}</h2>

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
