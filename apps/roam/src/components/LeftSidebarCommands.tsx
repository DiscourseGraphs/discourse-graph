import React, { MouseEvent } from "react";
import { Popover, Position, Button, Menu, MenuItem } from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types";
import { createDiscourseNodeFromCommand } from "~/utils/registerCommandPaletteCommands";

export const commands: Record<string, (ola: OnloadArgs) => Promise<void>> = {
  /* eslint-disable @typescript-eslint/require-await */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "Create Node": async (ola: OnloadArgs) => {
    createDiscourseNodeFromCommand(ola.extensionAPI);
    // typescript-eslint/naming-convention
  },
  /* eslint-enable @typescript-eslint/require-await */
};

export const sidebarCommandPopover = (onSelect: (value: string) => void) => {
  const handleClick = (event: MouseEvent) => {
    onSelect((event.target as Node).textContent!);
  };

  return (
    <Popover
      content={
        <Menu>
          {Object.keys(commands).map((commandName) => (
            <MenuItem
              key={commandName}
              text={commandName}
              onClick={handleClick}
            />
          ))}
        </Menu>
      }
      position={Position.BOTTOM_LEFT}
    >
      <Button icon="cog" small minimal title="Commands" />
    </Popover>
  );
};
