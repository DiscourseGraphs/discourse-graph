import { OnloadArgs } from "roamjs-components/types";
import { createDiscourseNodeFromCommand } from "~/utils/registerCommandPaletteCommands";

export const commands: Record<string, (ola: OnloadArgs) => Promise<void>> = {
  "Create Node": async (ola: OnloadArgs) => {
    createDiscourseNodeFromCommand(ola.extensionAPI);
  },
};
