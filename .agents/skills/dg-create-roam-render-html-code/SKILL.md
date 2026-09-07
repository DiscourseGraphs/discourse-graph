---
name: dg-create-roam-render-html-code
description: Wrap a completed HTML artifact in a Roam-compatible React iframe renderer and save it as a local code file. Use when the user asks to turn HTML output into Roam render HTML code.
---

# DG Create Roam Render HTML Code

Take the completed HTML from the current request or from the HTML file the user identifies. Create one local file containing that HTML inside the following JavaScript wrapper. Default to a `.js` file in the current working directory named `<subject>-roam-render.js`; honor any filename, extension, or output path the user supplies.

Derive concise, descriptive names from the HTML's subject:

- Use an uppercase `UPPER_SNAKE_CASE` constant ending in `_HTML`.
- Use a lower camel case function name that describes the rendered artifact.
- Use a short, human-readable iframe title.

```js
const USEFUL_NAMED_VARIABLE = String.raw`
<!-- INSERT HTML HERE -->
`;

function usefulNamedFunction(props) {
  const React = window.React;
  if (!React) return null;

  return React.createElement("iframe", {
    title: "Useful named title",
    srcDoc: USEFUL_NAMED_VARIABLE,
    loading: "eager",
    style: {
      width: "100%",
      height: "calc(100vh - 140px)",
      minHeight: "720px",
      display: "block",
      border: "1px solid #d8d2c5",
      borderRadius: "10px",
      background: "#f4f0e6",
    },
  });
}
```

Replace the placeholder comment with the complete HTML; do not summarize, redesign, minify, or omit any of it. Preserve the wrapper's iframe options and styles unless the user explicitly requests changes.

Ensure the resulting JavaScript is syntactically valid without changing the HTML produced at runtime. A tagged `String.raw` template preserves escape characters, so do not escape embedded backticks or `${` sequences with a backslash. If either sequence occurs in the HTML, encode it with a template interpolation that evaluates to the original literal text, such as `${"`"}`for a backtick or`${"${"}`for`${`.

After writing the file, report its path. Do not paste the complete generated file into the response unless the user asks.
