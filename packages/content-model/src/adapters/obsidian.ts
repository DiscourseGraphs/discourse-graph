import type {
  DgAnnotation,
  DgBlockAnnotation,
  DgDocument,
  DgInlineAnnotation,
  DgText,
} from "../schema/index.js";
import { dgDocumentSchemaVersion } from "../schema/index.js";
import {
  normalizeLineEndings,
  stripFrontmatter,
  stripTitleHeading,
  trimBlankLines,
} from "../text/index.js";
import { assertDgDocument } from "../validation/index.js";
import { parseMarkdownInline, renderObsidianInline } from "./inline.js";

type ParsedBlock = {
  content: string;
  blockType: DgBlockAnnotation["blockType"];
  attributes?: DgBlockAnnotation["attributes"];
  parentId?: string;
  consumedLines?: number;
  parseInline?: boolean;
};

const getListDepth = (indentation: string): number => {
  const normalized = indentation.replaceAll("\t", "  ");
  return Math.floor(normalized.length / 2);
};

const parseMarkdownBlock = ({
  lines,
  index,
  listParents,
}: {
  lines: readonly string[];
  index: number;
  listParents: Map<number, string>;
}): ParsedBlock => {
  const line = lines[index] ?? "";
  const fence = /^```([^\s`]*)\s*$/.exec(line);
  if (fence !== null) {
    const codeLines: string[] = [];
    let cursor = index + 1;
    while (cursor < lines.length && !/^```\s*$/.test(lines[cursor] ?? "")) {
      codeLines.push(lines[cursor] ?? "");
      cursor += 1;
    }
    const hasClosingFence = cursor < lines.length;
    return {
      content: codeLines.join("\n"),
      blockType: "code-block",
      attributes: { language: fence[1] || undefined },
      consumedLines: codeLines.length + (hasClosingFence ? 2 : 1),
      parseInline: false,
    };
  }

  const heading = /^(#{1,6})\s+(.*)$/.exec(line);
  if (heading !== null) {
    return {
      content: heading[2] ?? "",
      blockType: "heading",
      attributes: { level: heading[1]?.length ?? 1 },
    };
  }

  const listItem = /^(\s*)([-+*]|\d+\.)\s+(?:\[([ xX])\]\s+)?(.*)$/.exec(line);
  if (listItem !== null) {
    const depth = getListDepth(listItem[1] ?? "");
    const parentId = depth === 0 ? undefined : listParents.get(depth - 1);
    return {
      content: listItem[4] ?? "",
      blockType: "list-item",
      parentId,
      attributes: {
        depth,
        listStyle: /^\d/.test(listItem[2] ?? "") ? "number" : "bullet",
        ...(listItem[3] === undefined
          ? {}
          : { checked: listItem[3].toLowerCase() === "x" }),
      },
    };
  }

  const blockquote = /^>\s?(.*)$/.exec(line);
  if (blockquote !== null) {
    return { content: blockquote[1] ?? "", blockType: "blockquote" };
  }

  return { content: line, blockType: "paragraph" };
};

const offsetAnnotations = ({
  annotations,
  offset,
}: {
  annotations: readonly DgInlineAnnotation[];
  offset: number;
}): DgInlineAnnotation[] =>
  annotations.map((annotation) => ({
    ...annotation,
    start: annotation.start + offset,
    end: annotation.end + offset,
  }));

const parseObsidianBody = (markdown: string): DgText => {
  if (markdown === "") return { text: "", annotations: [] };
  const lines = markdown.split("\n");
  const annotations: DgAnnotation[] = [];
  const listParents = new Map<number, string>();
  let text = "";
  let blockIndex = 0;
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? "";
    if (line.trim() === "") {
      text += "\n";
      lineIndex += 1;
      continue;
    }

    const block = parseMarkdownBlock({
      lines,
      index: lineIndex,
      listParents,
    });
    const id = `obsidian-block-${blockIndex}`;
    const parsedInline =
      block.parseInline === false
        ? { text: block.content, annotations: [] }
        : parseMarkdownInline(block.content);
    const start = text.length;
    text += parsedInline.text;
    const end = text.length;
    annotations.push(
      ...offsetAnnotations({
        annotations: parsedInline.annotations,
        offset: start,
      }),
      {
        type: "block",
        id,
        ...(block.parentId === undefined ? {} : { parentId: block.parentId }),
        blockType: block.blockType,
        ...(block.attributes === undefined
          ? {}
          : { attributes: block.attributes }),
        start,
        end,
      },
    );

    if (block.blockType === "list-item") {
      const depth = block.attributes?.depth ?? 0;
      listParents.set(depth, id);
      [...listParents.keys()]
        .filter((candidateDepth) => candidateDepth > depth)
        .forEach((candidateDepth) => listParents.delete(candidateDepth));
    } else {
      listParents.clear();
    }

    const consumedLines = block.consumedLines ?? 1;
    lineIndex += consumedLines;
    blockIndex += 1;
    if (lineIndex < lines.length) text += "\n";
  }

  return { text, annotations };
};

export const obsidianMarkdownToDgDocument = ({
  title,
  markdown,
}: {
  title: string;
  markdown: string;
}): DgDocument => {
  const normalized = normalizeLineEndings(markdown);
  const withoutFrontmatter = stripFrontmatter(normalized);
  const bodyMarkdown = trimBlankLines(
    stripTitleHeading({ markdown: withoutFrontmatter, title }),
  );
  const parsedTitle = parseMarkdownInline(title);
  return assertDgDocument({
    version: dgDocumentSchemaVersion,
    title: parsedTitle,
    body: parseObsidianBody(bodyMarkdown),
  });
};

const getInlineSlice = ({
  value,
  start,
  end,
}: {
  value: DgText;
  start: number;
  end: number;
}): { text: string; annotations: DgInlineAnnotation[] } => ({
  text: value.text.slice(start, end),
  annotations: value.annotations.flatMap((annotation) => {
    if (
      annotation.type === "block" ||
      annotation.start < start ||
      annotation.end > end
    ) {
      return [];
    }
    return [
      {
        ...annotation,
        start: annotation.start - start,
        end: annotation.end - start,
      },
    ];
  }),
});

const getBlockPrefix = (block: DgBlockAnnotation): string => {
  switch (block.blockType) {
    case "heading":
      return `${"#".repeat(block.attributes?.level ?? 1)} `;
    case "list-item": {
      const indentation = "  ".repeat(block.attributes?.depth ?? 0);
      const marker = block.attributes?.listStyle === "number" ? "1." : "-";
      const checkbox =
        block.attributes?.checked === undefined
          ? ""
          : `[${block.attributes.checked ? "x" : " "}] `;
      return `${indentation}${marker} ${checkbox}`;
    }
    case "blockquote":
      return "> ";
    case "paragraph":
    case "code-block":
      return "";
  }
};

const renderObsidianBody = (body: DgText): string => {
  const blocks = body.annotations
    .filter(
      (annotation): annotation is DgBlockAnnotation =>
        annotation.type === "block",
    )
    .sort((left, right) => left.start - right.start || left.end - right.end);
  if (blocks.length === 0) {
    return renderObsidianInline({
      text: body.text,
      annotations: body.annotations.filter(
        (annotation): annotation is DgInlineAnnotation =>
          annotation.type !== "block",
      ),
    });
  }

  let result = "";
  let cursor = 0;
  blocks.forEach((block) => {
    result += body.text.slice(cursor, block.start);
    const content = getInlineSlice({
      value: body,
      start: block.start,
      end: block.end,
    });
    if (block.blockType === "code-block") {
      const language = block.attributes?.language ?? "";
      result += `\`\`\`${language}\n${content.text}\n\`\`\``;
    } else {
      result += getBlockPrefix(block) + renderObsidianInline(content);
    }
    cursor = block.end;
  });
  result += body.text.slice(cursor);
  return result;
};

export const dgDocumentToObsidianMarkdown = ({
  document,
}: {
  document: DgDocument;
}): string => {
  assertDgDocument(document);
  const renderedTitle = renderObsidianInline({
    text: document.title.text,
    annotations: document.title.annotations.filter(
      (annotation): annotation is DgInlineAnnotation =>
        annotation.type !== "block",
    ),
  });
  const renderedBody = renderObsidianBody(document.body);
  return renderedBody === ""
    ? `# ${renderedTitle}\n`
    : `# ${renderedTitle}\n\n${renderedBody}\n`;
};
