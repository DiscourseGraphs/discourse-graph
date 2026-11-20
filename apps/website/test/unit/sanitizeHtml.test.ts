import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  jsonForScript,
  sanitizeHtml,
} from "../../app/utils/conversion/sanitizeHtml";

describe("sanitizeHtml", () => {
  it("keeps ordinary rendered markdown", () => {
    const html =
      '<h2 id="a">Title</h2><p>Some <em>text</em> and <a href="https://example.com">a link</a>.</p><ul><li>item</li></ul><pre><code>x &lt; y</code></pre><img src="https://example.com/a.png" alt="figure">';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("removes scripts and event handlers", () => {
    expect(sanitizeHtml("<p>a</p><script>alert(1)</script>")).toBe("<p>a</p>");
    expect(sanitizeHtml('<img src="x.png" onerror="alert(1)">')).toBe(
      '<img src="x.png">',
    );
  });

  it("removes javascript URLs", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe(
      "<a>x</a>",
    );
  });

  it("removes styles, forms and frames", () => {
    expect(
      sanitizeHtml(
        '<p style="position:fixed">a</p><style>p{}</style><form><input></form><iframe src="https://example.com"></iframe>',
      ),
    ).toBe("<p>a</p>");
  });
});

describe("escapeHtml", () => {
  it("escapes markup and quotes", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("jsonForScript", () => {
  it("keeps a closing script tag inside the JSON", () => {
    const serialized = jsonForScript({ title: "</script><script>alert(1)" });
    expect(serialized).not.toContain("</script>");
    expect(JSON.parse(serialized)).toEqual({
      title: "</script><script>alert(1)",
    });
  });
});
