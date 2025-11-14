export const DEFAULT_MODEL_NAME = "gpt-4o-mini";

export type AgentModelName = keyof typeof AGENT_MODEL_DEFINITIONS;
export type AgentModelProvider = "openai";

export interface AgentModelDefinition {
  name: AgentModelName;
  id: string;
  provider: AgentModelProvider;
}

/**
 * Get the full information about a model from its name.
 * @param modelName - The name of the model.
 * @returns The full definition of the model.
 */
export function getAgentModelDefinition(
  modelName: AgentModelName,
): AgentModelDefinition {
  const definition = AGENT_MODEL_DEFINITIONS[modelName];
	if (!definition) {
    throw new Error(`Model ${modelName} not found`);
	}
  return definition;
}

export const AGENT_MODEL_DEFINITIONS = {
  "gpt-4o-mini": {
    name: "gpt-4o-mini",
    id: "gpt-4o-mini",
    provider: "openai",
  },
  "gpt-4o": {
    name: "gpt-4o",
    id: "gpt-4o",
    provider: "openai",
  },
} as const;
