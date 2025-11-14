import { getPromptPartUtilsRecord } from "../../../../../../roam/src/components/canvas/agent/shared/AgentUtils";
import { AgentPrompt } from "../../../../../../roam/src/components/canvas/agent/shared/types/AgentPrompt";
import {
  AgentModelName,
  DEFAULT_MODEL_NAME,
} from "../../../../../../roam/src/components/canvas/agent/worker/models";

/**
 * Get the selected model name from a prompt.
 */
export function getModelName(prompt: AgentPrompt): AgentModelName {
  const utils = getPromptPartUtilsRecord();

  for (const part of Object.values(prompt)) {
    const util = utils[part.type];
    if (!util) continue;
    const modelName = util.getModelName(part);
    if (modelName) return modelName;
  }

  return DEFAULT_MODEL_NAME;
}
