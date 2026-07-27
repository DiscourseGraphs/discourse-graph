export const normalizeLineEndings = (text: string): string =>
  text.replace(/\r\n?/g, "\n");
