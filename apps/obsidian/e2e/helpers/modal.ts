import type { Page } from "@playwright/test";
import { E2E_TIMEOUT } from "../constants";

const modalRoot = ".modal-container";

export const waitForModal = async (page: Page): Promise<void> => {
  await page.waitForSelector(modalRoot, { timeout: E2E_TIMEOUT });
  await page.waitForSelector(`${modalRoot} textarea`, { timeout: E2E_TIMEOUT });
};

export const selectNodeType = async (
  page: Page,
  label: string,
): Promise<void> => {
  const nodeTypeSelect = page.locator(`${modalRoot} select`).first();
  await nodeTypeSelect.waitFor({ state: "visible", timeout: E2E_TIMEOUT });
  await nodeTypeSelect.selectOption({ label });
};

export const fillNodeContent = async (
  page: Page,
  content: string,
): Promise<void> => {
  const contentInput = page.locator(`${modalRoot} textarea`).first();
  await contentInput.waitFor({ state: "visible", timeout: E2E_TIMEOUT });
  await contentInput.click();
  await contentInput.fill(content);
};

export const confirmModal = async (page: Page): Promise<void> => {
  const confirmButton = page.locator(`${modalRoot} button.mod-cta`);
  await confirmButton.waitFor({ state: "visible", timeout: E2E_TIMEOUT });
  await confirmButton.click({ force: true });
  await page.waitForSelector(modalRoot, {
    state: "hidden",
    timeout: E2E_TIMEOUT,
  });
};
