import createDOMPurify, { type DOMPurify } from "dompurify";
import { JSDOM } from "jsdom";

let purifier: DOMPurify | undefined;

const getPurifier = (): DOMPurify => {
  purifier ??= createDOMPurify(new JSDOM("").window);
  return purifier;
};

// Node bodies are user-written markdown, and markdown passes raw HTML through.
// Every body served as HTML from our domain must go through this.
export const sanitizeHtml = (html: string): string =>
  getPurifier().sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["style"],
  });

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);

// JSON for an inline `<script type="application/ld+json">`: escaping `<` keeps
// a `</script>` inside any string value from closing the element.
export const jsonForScript = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, "\\u003c");
