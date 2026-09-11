import { updateBlock } from "roamjs-components/writes";
import { renderCanvasEmbedDialog } from "~/components/canvas/CanvasEmbedDialog";
import { renderCanvasFrameEmbedDialog } from "~/components/canvas/CanvasFrameEmbedDialog";
import { serializeDgCanvasEmbed } from "~/utils/dgCanvasEmbed";

type SlashCommandContext = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "block-uid": string;
};

type SlashCommandApi = {
  addCommand: (cmd: {
    label: string;
    callback: (context: SlashCommandContext) => void;
  }) => void;
  removeCommand: (cmd: { label: string }) => void;
};

const getSlashCommandApi = (): SlashCommandApi =>
  (window.roamAlphaAPI.ui as unknown as { slashCommand: SlashCommandApi })
    .slashCommand;

const SLASH_COMMANDS: {
  label: string;
  callback: (context: SlashCommandContext) => void;
}[] = [
  {
    label: "DG: Embed canvas",
    callback: (context) => {
      const uid = context["block-uid"];
      if (!uid) return;
      renderCanvasEmbedDialog({
        onSelect: (title: string) => {
          void updateBlock({
            uid,
            text: `{{dg-canvas: [[${title}]]}}`,
          }).then(() => document.body.click());
        },
      });
    },
  },
  {
    label: "DG: Embed canvas frame",
    callback: (context) => {
      const uid = context["block-uid"];
      if (!uid) return;
      renderCanvasFrameEmbedDialog({
        onSelect: ({ title, frameName, frameShapeId }) => {
          void updateBlock({
            uid,
            text: serializeDgCanvasEmbed({ title, frameName, frameShapeId }),
          }).then(() => document.body.click());
        },
      });
    },
  },
];

export const registerSlashCommands = (): (() => void) => {
  const api = getSlashCommandApi();
  for (const cmd of SLASH_COMMANDS) api.addCommand(cmd);
  return () => {
    for (const { label } of SLASH_COMMANDS) api.removeCommand({ label });
  };
};
