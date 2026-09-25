import type { InputTextNode } from "roamjs-components/types";

const indent = (s: string): string =>
  s
    .split("\n")
    .map((l) => "   " + l)
    .join("\n") + "\n";

const templateToText = (template: InputTextNode[]): string =>
  template
    .filter((itn) => !itn.text.startsWith("{{"))
    .map(
      (itn) =>
        `* ${itn.text}\n${itn.children?.length ? indent(templateToText(itn.children)) : ""}`,
    )
    .join("");

// Shared by sync and publish so both write, or both omit, the same value.
export const nodeTemplateContent = (
  template: InputTextNode[] | undefined,
): string | undefined => {
  const text = templateToText(template ?? []);
  return text.length > 0 ? text : undefined;
};
