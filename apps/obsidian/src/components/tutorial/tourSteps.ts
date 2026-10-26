export type Placement = "top" | "bottom" | "left" | "right";

/** Calls `done` once the user has completed the step; returns a cleanup. */
export type WatchDone = (done: () => void) => () => void;

export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** CSS selector to spotlight. Without one the step shows as a floating card. */
  target?: string;
  placement?: Placement;
  /** Without one the step advances only through the Next button. */
  watchDone?: WatchDone;
  /** Obsidian basics that users who already know Obsidian can skip. */
  basics?: boolean;
};

// Delegated from the document so the step still completes if Obsidian re-renders the target.
export const doneOnClick =
  (selector: string): WatchDone =>
  (done) => {
    const handleClick = (event: MouseEvent): void => {
      if (event.target instanceof Element && event.target.closest(selector)) {
        done();
      }
    };
    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, { capture: true });
  };

export const doneWhenPresent =
  (selector: string): WatchDone =>
  (done) => {
    if (document.querySelector(selector)) {
      done();
      return () => {};
    }
    const observer = new MutationObserver(() => {
      if (!document.querySelector(selector)) return;
      observer.disconnect();
      done();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  };
