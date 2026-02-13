import type { Result } from "./types";

const EACH_BLOCK = /\{\{\s*#each\s+results\s*\}\}([\s\S]*?)\{\{\s*\/each\s*\}\}/;
const RESULT_KEY = /\{\{\s*result\.([\w-]+)\s*\}\}/g;

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const substituteResult = ({
  body,
  result,
}: {
  body: string;
  result: Result;
}): string =>
  body.replace(RESULT_KEY, (_, key: string) => {
    return escapeHtml(result[key]);
  });

export const compileTemplate = ({
  template,
  results,
}: {
  template: string;
  results: Result[];
}): string => {
  let output = template;
  let match = output.match(EACH_BLOCK);

  while (match) {
    const [fullMatch, body] = match;
    const replacement = results
      .map((result) => substituteResult({ body, result }))
      .join("");

    output = output.replace(fullMatch, replacement);
    match = output.match(EACH_BLOCK);
  }

  return output;
};

export const sanitizeHtml = ({ html }: { html: string }): string => {
  if (typeof document === "undefined") return html;

  const container = document.createElement("div");
  container.innerHTML = html;

  container
    .querySelectorAll("script, iframe, object, embed, style[type='text/javascript']")
    .forEach((el) => el.remove());

  container.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (
        /^on\w+/i.test(attr.name) ||
        ((attr.name === "href" || attr.name === "src") &&
          /^\s*javascript:/i.test(attr.value))
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return container.innerHTML;
};

