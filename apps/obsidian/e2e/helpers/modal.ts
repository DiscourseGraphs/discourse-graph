import type { Page } from "@playwright/test";

/**
 * Wait for the ModifyNodeModal to appear.
 */
export const waitForModal = async (page: Page): Promise<void> => {
  await page.waitForSelector(".modal-container", { timeout: 5_000 });
};

/**
 * Select a node type from the dropdown in the modal.
 */
export const selectNodeType = async (page: Page, label: string): Promise<void> => {
  const nodeTypeSelect = page.locator(".modal-container select").first();
  await nodeTypeSelect.selectOption({ label });
  await page.waitForTimeout(300);
};

/**
 * Fill the content/title input field in the modal.
 */
export const fillNodeContent = async (page: Page, content: string): Promise<void> => {
  const contentInput = page.locator(".modal-container input[type='text']").first();
  await contentInput.click();
  await contentInput.fill(content);
  await page.waitForTimeout(300);
};

/**
 * Click the Confirm button (mod-cta) in the modal.
 */
export const confirmModal = async (page: Page): Promise<void> => {
  // Use force: true to bypass any suggestion/autocomplete overlay that may cover the button
  await page.locator(".modal-container button.mod-cta").click({ force: true });
  await page.waitForTimeout(2_000);
};

/**
 * Click the Cancel button in the modal.
 */
export const cancelModal = async (page: Page): Promise<void> => {
  await page.locator(".modal-container button:not(.mod-cta)").click();
  await page.waitForTimeout(500);
};
