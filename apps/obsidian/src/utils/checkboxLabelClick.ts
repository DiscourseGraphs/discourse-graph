import type { MouseEvent } from "react";

/**
 * Click handler for a `<label>` wrapping a checkbox input (the node-type and
 * space filter rows): drives the toggle explicitly rather than relying
 * solely on native label-to-input click forwarding, which doesn't reliably
 * fire the input's own onChange in this app's rendering context — confirmed
 * empirically: clicking the checkbox itself works, clicking the label's text
 * or an icon/color dot next to it doesn't. `preventDefault`s that native
 * forwarding when it *does* happen, so a click on the text/dot can't drive
 * the toggle from both this handler and a forwarded native click, canceling
 * out to a no-op. Skipped when the click landed on the input itself, whose
 * own onChange already handles that case.
 */
export const handleCheckboxLabelClick = ({
  event,
  inputElement,
  onToggle,
}: {
  event: MouseEvent<HTMLLabelElement>;
  inputElement: HTMLInputElement | null;
  onToggle: () => void;
}): void => {
  if (event.target === inputElement) return;
  event.preventDefault();
  onToggle();
};

/**
 * Pair with `handleCheckboxLabelClick` on the label's `onMouseDown`. The
 * label's text/icon content isn't itself focusable, so a mousedown there
 * still runs the browser's default "blur whatever was focused" behavior —
 * and, unlike a real form control, nothing re-focuses afterward, since a
 * plain span/label has no native "activation" to move focus to. Left alone,
 * that permanently drops focus to `document.body`, which `SearchDropdown`'s
 * panel reads as "focus left" and closes on, unmounting this row before its
 * `onClick` (above) ever gets to run. Suppressed by preventing that default
 * mousedown behavior — skipped when the mousedown landed on the input
 * itself, so its own native focus-on-click behavior is untouched.
 */
export const handleCheckboxLabelMouseDown = ({
  event,
  inputElement,
}: {
  event: MouseEvent<HTMLLabelElement>;
  inputElement: HTMLInputElement | null;
}): void => {
  if (event.target === inputElement) return;
  event.preventDefault();
};
