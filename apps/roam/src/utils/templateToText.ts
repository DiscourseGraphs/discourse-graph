import { InputTextNode } from "roamjs-components/types";

const indent = (s: string): string =>
  s
    .split("\n")
    .map((l) => "   " + l)
    .join("\n") + "\n";

// A discourse node's template, as a markdown bullet list. Roam's own template
// macros ({{...}}) are dropped, as they mean nothing outside Roam.
export const templateToText = (template: InputTextNode[]): string =>
  template
    .filter((itn) => !itn.text.startsWith("{{"))
    .map(
      (itn) =>
        `* ${itn.text}\n${itn.children?.length ? indent(templateToText(itn.children)) : ""}`,
    )
    .join("");

export default templateToText;
