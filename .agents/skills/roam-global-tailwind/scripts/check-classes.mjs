#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_URL = "https://roamresearch.com/assets/css/tailwind.min.css";
const VERIFIED_SHA256 =
  "d2b34eb3b8e0519fbcf48718110ccdd35676b9ce9bf1be8594beba7eab3464ba";

const parseArguments = (arguments_) => {
  const options = { classNames: [], file: null, json: false, url: DEFAULT_URL };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (argument === "--file") {
      const file = arguments_[index + 1];
      if (!file || file.startsWith("--")) {
        throw new Error("--file requires a path");
      }
      options.file = file;
      index += 1;
      continue;
    }
    if (argument === "--url") {
      const url = arguments_[index + 1];
      if (!url || url.startsWith("--")) {
        throw new Error("--url requires a URL");
      }
      options.url = url;
      index += 1;
      continue;
    }
    options.classNames.push(argument);
  }

  if (!options.classNames.length) {
    throw new Error(
      "Usage: check-classes.mjs [--json] [--file CSS_PATH | --url URL] CLASS...",
    );
  }
  return options;
};

const readCss = async ({ file, url }) => {
  if (file) {
    const resolvedPath = path.resolve(file);
    return { bytes: await fs.readFile(resolvedPath), source: resolvedPath };
  }

  const response = await fetch(url, {
    headers: { "cache-control": "no-cache", pragma: "no-cache" },
  });
  if (!response.ok) {
    throw new Error(
      `Download failed: ${response.status} ${response.statusText}`,
    );
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    source: response.url,
  };
};

const isIdentifierCharacter = (character) => /[A-Za-z0-9_-]/.test(character);
const isIdentifierStartCharacter = (character) => /[A-Za-z_-]/.test(character);

const decodeClassIdentifier = (css, startIndex) => {
  let className = "";
  let index = startIndex;

  while (index < css.length) {
    const character = css[index];
    if (isIdentifierCharacter(character)) {
      className += character;
      index += 1;
      continue;
    }
    if (character !== "\\") break;

    index += 1;
    const hexadecimalMatch = css.slice(index).match(/^[0-9A-Fa-f]{1,6}/);
    if (hexadecimalMatch) {
      className += String.fromCodePoint(
        Number.parseInt(hexadecimalMatch[0], 16),
      );
      index += hexadecimalMatch[0].length;
      if (/\s/.test(css[index] ?? "")) index += 1;
      continue;
    }
    if (index < css.length) {
      className += css[index];
      index += 1;
    }
  }

  return { className, endIndex: index };
};

const maskCommentsAndStrings = (css) => {
  const maskedCharacters = css.split("");

  for (let index = 0; index < css.length; index += 1) {
    if (css[index] === "/" && css[index + 1] === "*") {
      maskedCharacters[index] = " ";
      maskedCharacters[index + 1] = " ";
      index += 2;
      while (index < css.length) {
        maskedCharacters[index] = " ";
        if (css[index] === "*" && css[index + 1] === "/") {
          maskedCharacters[index + 1] = " ";
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    const quote = css[index];
    if (quote !== '"' && quote !== "'") continue;

    maskedCharacters[index] = " ";
    index += 1;
    while (index < css.length) {
      maskedCharacters[index] = " ";
      if (css[index] === "\\") {
        if (index + 1 < css.length) {
          maskedCharacters[index + 1] = " ";
          index += 1;
        }
        index += 1;
        continue;
      }
      if (css[index] === quote) break;
      index += 1;
    }
  }

  return maskedCharacters.join("");
};

const DECLARATION_AT_RULES = new Set([
  "counter-style",
  "font-face",
  "font-feature-values",
  "page",
  "property",
]);

const getAtRuleContext = (prelude) => {
  const atRuleName = prelude.match(/^@([\w-]+)/)?.[1]?.toLowerCase();
  return atRuleName && DECLARATION_AT_RULES.has(atRuleName)
    ? "declarations"
    : "rules";
};

const addClassNamesFromSelector = ({
  classNames,
  css,
  endIndex,
  maskedCss,
  startIndex,
}) => {
  for (let index = startIndex; index < endIndex; index += 1) {
    if (maskedCss[index] !== ".") continue;
    const nextCharacter = css[index + 1] ?? "";
    if (nextCharacter !== "\\" && !isIdentifierStartCharacter(nextCharacter))
      continue;
    const decoded = decodeClassIdentifier(css, index + 1);
    if (decoded.className) classNames.add(decoded.className);
    index = decoded.endIndex - 1;
  }
};

const extractClassNames = (css) => {
  const classNames = new Set();
  const maskedCss = maskCommentsAndStrings(css);
  const contexts = ["rules"];
  let segmentStart = 0;

  for (let index = 0; index < maskedCss.length; index += 1) {
    const character = maskedCss[index];
    if (character === ";") {
      segmentStart = index + 1;
      continue;
    }
    if (character === "}") {
      if (contexts.length > 1) contexts.pop();
      segmentStart = index + 1;
      continue;
    }
    if (character !== "{") continue;

    const prelude = maskedCss.slice(segmentStart, index).trim();
    const context = contexts.at(-1);
    if (context === "rules" && !prelude.startsWith("@")) {
      addClassNamesFromSelector({
        classNames,
        css,
        endIndex: index,
        maskedCss,
        startIndex: segmentStart,
      });
      contexts.push("declarations");
    } else if (context === "rules") {
      contexts.push(getAtRuleContext(prelude));
    } else {
      contexts.push("declarations");
    }
    segmentStart = index + 1;
  }

  return classNames;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const { bytes, source } = await readCss(options);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const classNames = extractClassNames(bytes.toString("utf8"));
  const checks = Object.fromEntries(
    options.classNames.map((className) => [
      className,
      classNames.has(className),
    ]),
  );
  const result = {
    source,
    bytes: bytes.length,
    sha256,
    matchesVerifiedSnapshot: sha256 === VERIFIED_SHA256,
    checks,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`Source: ${source}\n`);
    process.stdout.write(`SHA-256: ${sha256}\n`);
    process.stdout.write(
      `Verified snapshot: ${result.matchesVerifiedSnapshot ? "match" : "DRIFT DETECTED"}\n`,
    );
    for (const [className, available] of Object.entries(checks)) {
      process.stdout.write(`${available ? "YES" : "NO "} ${className}\n`);
    }
  }

  if (Object.values(checks).some((available) => !available)) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
});
