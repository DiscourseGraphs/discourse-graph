import { useState, useEffect, useCallback } from "react";
import { useApp } from "./AppContext";
import { AppWithPlugins } from "~/services/QueryEngine";

export const DatacoreCallout = () => {
  const app = useApp();

  const datacorePlugin = (app as AppWithPlugins)?.plugins?.plugins?.[
    "datacore"
  ];

  if (datacorePlugin) return null;

  return (
    <div className="callout callout-warning mb-4 rounded-md border border-solid border-yellow-500/30 bg-yellow-500/10 p-4">
      <div className="callout-title flex items-center gap-2 font-semibold">
        ⚠️ Datacore plugin required
      </div>
      <div className="callout-content mt-2">
        <p>
          The Datacore plugin is required for Discourse Graphs to function.
          Please install and enable it.
        </p>
        <a
          href="obsidian://show-plugin?id=datacore"
          className="text-accent mt-2 inline-block underline"
        >
          Install Datacore
        </a>
      </div>
    </div>
  );
};
