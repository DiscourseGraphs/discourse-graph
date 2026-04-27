import React from "react";
import { Popover, Position, Button, Menu, MenuItem } from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types";
import { createDiscourseNodeFromCommand } from "~/utils/registerCommandPaletteCommands";

export const cleanCommandName = (name: string): string => {
  if (name.startsWith("{") && name.endsWith("}"))
    name = name.substring(1, name.length - 1);
  name = name.trim();
  // sentence case
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return name;
};

export const commands: Record<
  string,
  (onloadArgs: OnloadArgs) => Promise<void>
> = {
  /* eslint-disable @typescript-eslint/require-await */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "{create node}": async (onloadArgs: OnloadArgs) => {
    createDiscourseNodeFromCommand(onloadArgs.extensionAPI);
    // typescript-eslint/naming-convention
  },
  /* eslint-enable @typescript-eslint/require-await */
};

export const SidebarCommandPopover = ({
  onSelect,
}: {
  onSelect: (value: string) => void;
}) => {
  return (
    <Popover
      content={
        <Menu>
          {Object.keys(commands).map((commandName) => (
            <MenuItem
              key={commandName}
              text={commandName}
              onClick={() => onSelect(commandName)}
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
