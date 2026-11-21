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
