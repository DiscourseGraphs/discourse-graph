let articleWrapperObserver: MutationObserver | null = null;
let globalIsMinimized = false;

export const setGlobalIsMinimized = (value: boolean): void => {
  globalIsMinimized = value;
};

export const getGlobalIsMinimized = (): boolean => globalIsMinimized;

const BASE_SPACING_CLASSES = {
  "rm-spacing--large": "1400px",
  "rm-spacing--medium": "1000px",
  "rm-spacing--small": "800px",
  "rm-spacing--full": "2000px",
};
type SpacingClass = keyof typeof BASE_SPACING_CLASSES;

const getSpacingClass = (
  element: HTMLElement,
): { className: SpacingClass; value: string } | null => {
  for (const className of element.classList) {
    if (className in BASE_SPACING_CLASSES) {
      return {
        className: className as SpacingClass,
        value: BASE_SPACING_CLASSES[className as SpacingClass],
      };
    }
  }
  return null;
};

export const getRoamElements = (): {
  roamBodyMain: HTMLElement | null;
  articleWrapper: HTMLElement | null;
} => {
  const roamBodyMain = document.querySelector<HTMLElement>(".roam-body-main");
  const articleWrapper =
    roamBodyMain?.querySelector<HTMLElement>(".rm-article-wrapper") ?? null;
  return { roamBodyMain: roamBodyMain ?? null, articleWrapper };
};

export const updateArticleWrapperPadding = (
  articleWrapper: HTMLElement,
): void => {
  const { value } = getSpacingClass(articleWrapper) ?? { value: "800px" };
  articleWrapper.style.setProperty("padding-left", "0px", "important");
  articleWrapper.style.setProperty("padding-right", "0px", "important");
  articleWrapper.style.setProperty("max-width", value, "important");
};

export const resetArticleWrapperPadding = (
  articleWrapper: HTMLElement,
): void => {
  articleWrapper.style.removeProperty("padding-left");
  articleWrapper.style.removeProperty("padding-right");
  articleWrapper.style.removeProperty("max-width");
};

export const initializeArticleWrapperObserver = (): void => {
  if (articleWrapperObserver) return;
  const { articleWrapper } = getRoamElements();
  if (!articleWrapper) return;

  articleWrapperObserver = new MutationObserver((): void => {
    const panelRoot = document.getElementById(
      "discourse-graph-suggestions-root",
    );

    if (panelRoot && !getGlobalIsMinimized()) {
      updateArticleWrapperPadding(articleWrapper);
    } else {
      resetArticleWrapperPadding(articleWrapper);
    }
  });
  articleWrapperObserver.observe(articleWrapper, {
    attributes: true,
    attributeFilter: ["class"],
  });
};

export const cleanupArticleWrapperObserver = (): void => {
  if (articleWrapperObserver) {
    articleWrapperObserver.disconnect();
    articleWrapperObserver = null;
  }
};
export const setupSplitView = (
  roamBodyMain: HTMLElement,
  articleWrapper: HTMLElement,
): void => {
  roamBodyMain.style.display = "flex";
  roamBodyMain.dataset.isSplit = "true";
  updateArticleWrapperPadding(articleWrapper);
  cleanupArticleWrapperObserver();
  initializeArticleWrapperObserver();
};

export const teardownSplitView = (
  roamBodyMain: HTMLElement,
  articleWrapper: HTMLElement,
): void => {
  roamBodyMain.removeAttribute("data-is-split");
  roamBodyMain.style.display = "";
  articleWrapper.style.flex = "";
  resetArticleWrapperPadding(articleWrapper);
};
