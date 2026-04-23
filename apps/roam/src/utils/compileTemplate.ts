import type { Result } from "./types";

const EACH_BLOCK = /\{\{\s*#each\s+results\s*\}\}([\s\S]*?)\{\{\s*\/each\s*\}\}/;
const RESULT_KEY = /\{\{\s*result\.([\w-]+)\s*\}\}/g;
const RESULT_IF_CHANGED = /\{\{\s*resultIfChanged\.([\w-]+)\s*\}\}/g;
const IF_CHANGED_BLOCK =
  /\{\{\s*#ifChanged\s+result\.([\w-]+)\s*\}\}([\s\S]*?)\{\{\s*\/ifChanged\s*\}\}/g;

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const substituteResult = ({
  body,
  result,
  previousResult,
}: {
  body: string;
  result: Result;
  previousResult?: Result;
}): string =>
  body
    .replace(IF_CHANGED_BLOCK, (_, key: string, sectionBody: string) => {
      const currentValue = String(result[key] ?? "");
      const previousValue = String(previousResult?.[key] ?? "");
      return currentValue === previousValue ? "" : sectionBody;
    })
    .replace(RESULT_IF_CHANGED, (_, key: string) => {
      const currentValue = String(result[key] ?? "");
      const previousValue = String(previousResult?.[key] ?? "");
      return currentValue === previousValue ? "" : escapeHtml(result[key]);
    })
    .replace(RESULT_KEY, (_, key: string) => {
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
      .map((result, index) =>
        substituteResult({ body, result, previousResult: results[index - 1] }),
      )
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
