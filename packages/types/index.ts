export type ErrorEmailProps = {
  errorMessage: string;
  errorStack: string;
  type: string; // To identify the type of error, eg "Export Dialog Failed"
  app: "Roam" | "Obsidian";
  graphName: string;
  version?: string;
  buildDate?: string;
  context?: Record<string, unknown>;
};
