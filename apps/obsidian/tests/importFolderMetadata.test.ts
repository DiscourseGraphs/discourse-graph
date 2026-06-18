import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImportFolderBasename,
  isCustomFolderBasename,
  isExpectedMigratedBasename,
  isLegacyFolderBasename,
  sanitizeImportFolderName,
  shouldAutoRenameFolder,
} from "../src/utils/importFolderNaming.js";

test("buildImportFolderBasename sanitizes special characters", () => {
  assert.equal(
    buildImportFolderBasename("Alice Doe", "My/Vault"),
    "Alice Doe-MyVault",
  );
});

test("isLegacyFolderBasename matches sanitized vault names", () => {
  assert.equal(isLegacyFolderBasename("My Vault", "My Vault"), true);
  assert.equal(isLegacyFolderBasename("Alice-My Vault", "My Vault"), false);
});

test("isExpectedMigratedBasename matches prefixed folder names", () => {
  assert.equal(
    isExpectedMigratedBasename("Alice-My Vault", "Alice", "My Vault"),
    true,
  );
  assert.equal(
    isExpectedMigratedBasename("My Vault", "Alice", "My Vault"),
    false,
  );
});

test("shouldAutoRenameFolder only renames legacy unmigrated folders with username", () => {
  assert.equal(
    shouldAutoRenameFolder({
      metadata: {},
      basename: "My Vault",
      spaceName: "My Vault",
      userName: "Alice",
    }),
    true,
  );

  assert.equal(
    shouldAutoRenameFolder({
      metadata: { migrated: true },
      basename: "My Vault",
      spaceName: "My Vault",
      userName: "Alice",
    }),
    false,
  );

  assert.equal(
    shouldAutoRenameFolder({
      metadata: {},
      basename: "Custom Name",
      spaceName: "My Vault",
      userName: "Alice",
    }),
    false,
  );

  assert.equal(
    shouldAutoRenameFolder({
      metadata: {},
      basename: "My Vault",
      spaceName: "My Vault",
    }),
    false,
  );
});

test("isCustomFolderBasename treats unexpected names as custom", () => {
  assert.equal(
    isCustomFolderBasename({
      basename: "Renamed By User",
      spaceName: "My Vault",
      userName: "Alice",
    }),
    true,
  );

  assert.equal(
    isCustomFolderBasename({
      basename: buildImportFolderBasename("Alice", "My Vault"),
      spaceName: "My Vault",
      userName: "Alice",
    }),
    false,
  );
});

test("sanitizeImportFolderName trims and collapses whitespace", () => {
  assert.equal(sanitizeImportFolderName("  Alice   Doe  "), "Alice Doe");
});
