import sharedConfig from "@repo/tailwind-config";
import type { GraphColors } from "./graphBackground/colors";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const readColorToken = ({
  colors,
  path,
}: {
  colors: unknown;
  path: string[];
}): string => {
  const missing = new Error(`Missing color token: ${path.join(".")}`);
  let current = colors;
  for (const key of path) {
    if (!isRecord(current)) throw missing;
    current = current[key];
  }
  if (typeof current !== "string") throw missing;
  return current;
};

export const hexToRgbChannels = (hex: string): string => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) throw new Error(`Expected a 6-digit hex color, got ${hex}`);
  const value = parseInt(match[1], 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
};

// Read on the server and passed to the client canvas as props: importing the
// shared config in client code would bundle its Tailwind plugin.
export const getGraphColors = (): GraphColors => {
  const { theme } = sharedConfig as {
    theme?: { extend?: { colors?: unknown } };
  };
  const colors = theme?.extend?.colors;
  return {
    pulse: readColorToken({ colors, path: ["primary", "rgb"] }),
    edge: hexToRgbChannels(
      readColorToken({ colors, path: ["neutral", "dark"] }),
    ),
  };
};
