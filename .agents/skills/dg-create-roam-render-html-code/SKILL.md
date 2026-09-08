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
const ARTIFACT_HTML = "__HTML_SOURCE__";

function usefulNamedFunction(props) {
  const React = window.React;
  if (!React) return null;

  return React.createElement("iframe", {
    title: "Useful named title",
    srcDoc: ARTIFACT_HTML,
    sandbox: "allow-scripts",
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

Replace the entire `"__HTML_SOURCE__"` string literal with a JSON-serialized JavaScript string containing the complete HTML. Do not summarize, redesign, minify, omit, trim, or normalize line endings in the HTML. Preserve the wrapper's styles unless the user explicitly requests changes.

Generate the literal mechanically rather than escaping template delimiters by hand. Given the original `html` string and the wrapper above as `wrapper`, use:

```js
const htmlLiteral = JSON.stringify(html)
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");
const renderer = wrapper.replace('"__HTML_SOURCE__"', () => htmlLiteral);
```

The replacement callback preserves replacement-like text such as `$&` in the HTML. JSON serialization handles quotes, backslashes (including odd runs before backticks or `${` and a trailing backslash), control characters, and line endings without executing embedded expressions. Save `renderer` as the standalone `.js` file; do not wrap it in an HTML script tag.

Keep `sandbox: "allow-scripts"` for interactive artifacts. Omit `allow-same-origin` so embedded scripts cannot access Roam's parent DOM, authenticated storage, or APIs. For static HTML, use `sandbox: ""`. Add other sandbox permissions only for a specifically required capability; do not remove the sandbox or add `allow-same-origin` to restore parent access. Features requiring Roam APIs need a separately designed integration, not this iframe wrapper.

Before delivering a renderer, check its JavaScript syntax and verify that its evaluated `srcDoc` exactly equals the original HTML. Include backticks, `${`, quotes, dollar replacement patterns, CRLF, Unicode, and odd/even backslash runs before template delimiters and at end of input in regression checks. Run `node --test scripts/renderer.test.mjs` from this skill directory when changing this guidance.

After writing the file, report its path. Do not paste the complete generated file into the response unless the user asks.
