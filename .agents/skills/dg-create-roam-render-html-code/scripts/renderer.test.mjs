import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const skill = readFileSync(new URL("../SKILL.md", import.meta.url), "utf8");
const blocks = [...skill.matchAll(/```js\r?\n([\s\S]*?)```/g)].map(
  (match) => match[1],
);
const [wrapper, serializer] = blocks;

const render = (html) => {
  const source = vm.runInNewContext(`${serializer}\nrenderer`, {
    html,
    wrapper,
  });
  const script = new vm.Script(`${source}\nusefulNamedFunction({})`);
  return script.runInNewContext({
    window: { React: { createElement: (tag, props) => ({ tag, props }) } },
  });
};

test("documented serialization preserves HTML exactly without evaluating it", () => {
  const inputs = [
    "",
    '<h1 title="quoted">Hello</h1>\r\n',
    "` ${throwIfEvaluated()} $& $$ $' $`",
    "Unicode: 🦉 \u2028 \u2029 \u0000\t\n",
    "</script><script>window.parent.document</script>",
  ];
  for (let count = 0; count <= 6; count++) {
    const slashes = "\\".repeat(count);
    for (const suffix of ["`", "${throwIfEvaluated()}", ""]) {
      inputs.push(`<p>prefix</p>${slashes}${suffix}`);
    }
  }
  for (const html of inputs) {
    assert.equal(render(html).props.srcDoc, html, JSON.stringify(html));
  }
});

test("documented iframe permits scripts without same-origin or other privileges", () => {
  const result = render("<script>interactiveArtifact()</script>");
  assert.equal(result.tag, "iframe");
  assert.equal(result.props.sandbox, "allow-scripts");
});
