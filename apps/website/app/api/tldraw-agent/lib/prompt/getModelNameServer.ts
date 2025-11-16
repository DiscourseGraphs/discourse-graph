import {
  AgentModelName,
  DEFAULT_MODEL_NAME,
} from "../../../../../../roam/src/components/canvas/agent/models";

/**
 * Server-safe version of getModelName that doesn't instantiate prompt part utilities.
 * Extracts the model name directly from the prompt structure.
 */
export function getModelNameServer(prompt: any): AgentModelName {
  // Extract model name from the modelName part if present
  if (prompt.modelName?.modelName) {
    return prompt.modelName.modelName as AgentModelName;
  }

  return DEFAULT_MODEL_NAME;
}
