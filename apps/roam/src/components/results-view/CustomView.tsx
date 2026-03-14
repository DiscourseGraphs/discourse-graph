import React, { useMemo } from "react";
import { compileTemplate, sanitizeHtml } from "~/utils/compileTemplate";
import type { Result } from "~/utils/types";

export const DEFAULT_TEMPLATE = `<ul>
{{#each results}}
  <li>{{result.text}}</li>
{{/each}}
</ul>`;

type CustomViewProps = {
  results: Result[];
  template?: string;
};

const CustomView = ({ results, template = DEFAULT_TEMPLATE }: CustomViewProps) => {
  const html = useMemo(() => {
    const compiled = compileTemplate({ template, results });
    return sanitizeHtml({ html: compiled });
  }, [results, template]);

  return (
    <div
      className="roamjs-custom-results-view p-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default CustomView;

