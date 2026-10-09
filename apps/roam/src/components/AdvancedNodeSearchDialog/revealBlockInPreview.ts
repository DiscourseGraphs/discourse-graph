export const PREVIEW_FLASH_CLASS = "dg-search-preview-flash";

export const revealBlockInPreview = ({
  container,
  uid,
}: {
  container: HTMLElement;
  uid: string;
}): (() => void) => {
  const block = Array.from(
    container.querySelectorAll<HTMLElement>(".rm-block[data-block-uid]"),
  ).find(
    // Embeds render copies carrying the same uid; the real block sits outside them.
    (el) => el.dataset.blockUid === uid && !el.closest(".rm-embed-container"),
  );
  const row = block?.querySelector(":scope > .rm-block-main");
  if (!row) {
    container.scrollTop = 0;
    return () => undefined;
  }
  // Set scrollTop directly: scrollIntoView would also scroll Roam's main window.
  const rowRect = row.getBoundingClientRect();
  container.scrollTop +=
    rowRect.top -
    container.getBoundingClientRect().top -
    (container.clientHeight - rowRect.height) / 2;
  row.classList.add(PREVIEW_FLASH_CLASS);
  const clear = () => row.classList.remove(PREVIEW_FLASH_CLASS);
  row.addEventListener("animationend", clear, { once: true });
  return () => {
    row.removeEventListener("animationend", clear);
    clear();
  };
};
