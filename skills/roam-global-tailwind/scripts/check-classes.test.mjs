import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "check-classes.mjs",
);

const runChecker = (arguments_) =>
  spawnSync(process.execPath, [SCRIPT_PATH, ...arguments_], {
    encoding: "utf8",
  });

test("decodes escaped Tailwind class selectors", () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "roam-global-tailwind-"),
  );
  const cssPath = path.join(temporaryDirectory, "tailwind.css");
  fs.writeFileSync(
    cssPath,
    ".flex{display:flex}.\\32xl\\:grid{display:grid}.hover\\:bg-blue-500:hover{color:#00f}.w-1\\/2{width:50%}.\\!p-4{padding:1rem}",
  );

  try {
    const result = runChecker([
      "--json",
      "--file",
      cssPath,
      "flex",
      "2xl:grid",
      "hover:bg-blue-500",
      "w-1/2",
      "!p-4",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).checks, {
      flex: true,
      "2xl:grid": true,
      "hover:bg-blue-500": true,
      "w-1/2": true,
      "!p-4": true,
    });
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }
});

test("returns one when a requested class is absent", () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "roam-global-tailwind-"),
  );
  const cssPath = path.join(temporaryDirectory, "tailwind.css");
  fs.writeFileSync(cssPath, ".flex{display:flex}");

  try {
    const result = runChecker(["--json", "--file", cssPath, "aspect-square"]);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).checks["aspect-square"], false);
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }
});

test("rejects an incomplete file option", () => {
  const result = runChecker(["--file"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--file requires a path/);
});
