import { expect, type Page } from "@playwright/test";
import { QUESTION_NODE_PREFIX } from "../constants";
import { executeCommand, executeCommandViaPalette } from "../helpers/commands";
import { findFilesByPrefix, readFileContent } from "../helpers/vault";
import {
  waitForModal,
  selectNodeType,
  fillNodeContent,
  confirmModal,
} from "../helpers/modal";
import { captureStep } from "../helpers/screenshots";

export type NodeCreationTrigger = "command" | "palette";

export const runNodeCreationScenario = async ({
  page,
  testName,
  trigger = "command",
}: {
  page: Page;
  testName: string;
  trigger?: NodeCreationTrigger;
}): Promise<void> => {
  if (trigger === "command") {
    await executeCommand(page);
  } else {
    await executeCommandViaPalette(page);
  }
  await waitForModal(page);
  await captureStep({ page, testName, stepName: "01-modal-open" });

  const nodeContent = `What is discourse graph testing ${Date.now()}`;
  const expectedBasename = `${QUESTION_NODE_PREFIX}${nodeContent}`;

  await selectNodeType(page, "Question");
  await fillNodeContent(page, nodeContent);
  await captureStep({ page, testName, stepName: "02-modal-filled" });

  await confirmModal(page);
  await captureStep({ page, testName, stepName: "03-node-created" });

  const files = await findFilesByPrefix(page, QUESTION_NODE_PREFIX);
  expect(
    files,
    `Expected a Question node file named "${expectedBasename}"`,
  ).toContain(expectedBasename);

  const content = await readFileContent(page, expectedBasename);
  expect(
    content,
    `Expected frontmatter in ${expectedBasename} to include nodeTypeId`,
  ).toContain("nodeTypeId");
};
