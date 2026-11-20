import { FORMAT_PLACEHOLDER } from "./decorateTitle";

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getDiscourseNodeFormatInnerExpression = (format: string): string =>
  format.split(FORMAT_PLACEHOLDER).map(escapeRegExp).join("(.*?)");

export const getDiscourseNodeFormatExpression = (format: string): RegExp =>
  format
    ? new RegExp(`^${getDiscourseNodeFormatInnerExpression(format)}$`, "s")
    : /$^/;
