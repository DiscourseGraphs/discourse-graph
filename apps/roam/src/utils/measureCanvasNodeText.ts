type DefaultStyles = {
  fontFamily: string;
  fontStyle: string;
  fontWeight: string;
  fontSize: number;
  lineHeight: number;
  width: string;
  minWidth?: string;
  maxWidth?: string;
  padding: string;
  text: string;
};

// node_modules\@tldraw\tldraw\node_modules\@tldraw\editor\dist\cjs\lib\app\managers\TextManager.js
export const measureCanvasNodeText = (opts: DefaultStyles) => {
  const fixNewLines = /\r?\n|\r/g;

  const normalizeTextForDom = (text: string) => {
    return text
      .replace(fixNewLines, "\n")
      .split("\n")
      .map((x) => x || " ")
      .join("\n");
  };

  const measureText = (opts: DefaultStyles) => {
    const elm = document.createElement("div");
    document.body.appendChild(elm);
    elm.setAttribute("dir", "ltr");
    elm.style.setProperty("font-family", opts.fontFamily);
    elm.style.setProperty("font-style", opts.fontStyle);
    elm.style.setProperty("font-weight", opts.fontWeight);
    elm.style.setProperty("font-size", opts.fontSize + "px");
    elm.style.setProperty(
      "line-height",
      opts.lineHeight * opts.fontSize + "px",
    );
    elm.style.setProperty("width", opts.width);
    elm.style.setProperty("min-width", opts.minWidth ?? null);
    elm.style.setProperty("max-width", opts.maxWidth ?? null);
    elm.style.setProperty("padding", opts.padding);

    elm.textContent = normalizeTextForDom(opts.text);
    const rect = elm.getBoundingClientRect();
    elm.remove();
    return {
      x: 0,
      y: 0,
      w: rect.width,
      h: rect.height,
    };
  };

  const { w, h } = measureText(opts);

  return { w, h };
};
