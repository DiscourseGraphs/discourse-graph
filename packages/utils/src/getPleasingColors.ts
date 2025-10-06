import { colord, extend, type Colord } from "colord";
import a11yPlugin from "colord/plugins/a11y";
import mixPlugin from "colord/plugins/mix";
extend([a11yPlugin, mixPlugin]);

type PleasingColorScheme = {
  primary: string; // input color
  background: string; // lighter on-hue bg
  text: string; // darker on-hue text
  border: string; // mid-tone border
  contrastRatio: number;
  level: "AAA" | "AA";
};

const searchNeutralTextForAA = (
  bg: Colord,
  target = 4.5,
): { c: Colord; cr: number } => {
  // Search along neutral gray axis for the lightest/darkest text that passes.
  // For a light bg we’ll search dark grays [0..40] and pick the lightest that meets target.
  let lo = 0,
    hi = 40; // dark side only (we’re in on-light mode)
  let best: { c: Colord; cr: number } | null = null;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const t = colord({ h: 0, s: 0, l: mid }); // neutral gray
    const cr = bg.contrast(t);
    if (cr >= target) {
      best = { c: t, cr }; // keep the **lightest** passing dark gray
      hi = mid - 0.0001;
    } else {
      lo = mid + 0.0001;
    }
    if (Math.abs(hi - lo) < 0.0001) break;
  }
  // If nothing found (shouldn't happen for a light bg), return hard black.
  return best ?? { c: colord("#000000"), cr: bg.contrast("#000") };
};

const setLightness = (c: Colord, lightness: number): Colord => {
  const { h, s } = c.toHsl();
  return colord({ h, s, l: Math.max(0, Math.min(100, lightness)) });
};

// Search lightness of 'a' (keeping hue & sat), to reach target contrast vs fixed 'b'
const searchTone = (
  aSeed: Colord,
  bFixed: Colord,
  options: { target: number; lowL: number; highL: number; maxIter?: number },
): { c: Colord; cr: number } | null => {
  const { target, lowL, highL, maxIter = 24 } = options;
  let lo = lowL,
    hi = highL;
  let best: { c: Colord; cr: number } | null = null;

  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const candidate = setLightness(aSeed, mid);
    const cr = candidate.contrast(bFixed);

    if (cr >= target && (!best || cr < best.cr)) best = { c: candidate, cr };

    // move the candidate farther from bFixed’s lightness when contrast is too low
    const aL = candidate.toHsl().l;
    const bL = bFixed.toHsl().l;
    const aIsLighter = aL > bL;

    if (cr < target) {
      // push 'a' away from 'b' in lightness space
      if (aIsLighter) hi = mid - 0.0001;
      else lo = mid + 0.0001;
    } else {
      // we have enough contrast; try to bring them a tad closer (softer)
      if (aIsLighter) lo = mid + 0.0001;
      else hi = mid - 0.0001;
    }

    if (Math.abs(hi - lo) < 0.0001) break;
  }

  return best;
};

// Gentle desat for very light BGs to avoid chalkiness
const softenBg = (c: Colord, amt = 0.1) => {
  const { h, s, l } = c.toHsl();
  const s2 = l > 85 ? s * (1 - amt) : s; // only soften very light tones
  return colord({ h, s: Math.max(0, Math.min(100, s2)), l });
};

const findTextWithTargetContrast = (
  textSeed: Colord,
  background: Colord,
): { text: Colord; level: "AAA" | "AA" } => {
  const maxTextLightness = Math.min(60, background.toHsl().l - 5);

  // Try AAA first
  let textAAA = searchTone(textSeed, background, {
    target: 7.0,
    lowL: 2,
    highL: maxTextLightness,
  });
  let level: "AAA" | "AA" = "AAA";

  // If AAA fails, try AA for text; still keeping hue/sat
  if (!textAAA) {
    textAAA = searchTone(textSeed, background, {
      target: 4.5,
      lowL: 2,
      highL: maxTextLightness,
    });
    level = "AA";
  }

  return { text: textAAA?.c ?? textSeed, level };
};

export const getPleasingColors = (inputColor: Colord): PleasingColorScheme => {
  const base = inputColor;
  const { h, s, l } = base.toHsl();
  const AAA = 7.0,
    AA = 4.5;

  // Seed a light background (on-light aesthetic), keep hue/sat
  let bgSeed = colord({ h, s, l: Math.max(88, Math.min(94, Math.max(l, 90))) });
  bgSeed = softenBg(bgSeed, 0.12);

  // Seed text by nudging darker than base but not forcing to 18–32 band
  let textSeed = colord({ h, s, l: Math.max(8, Math.min(50, l - 35)) });

  // Find text color that meets contrast requirements
  const { text: initialText, level: initialLevel } = findTextWithTargetContrast(
    textSeed,
    bgSeed,
  );

  // try adjusting BG instead, keeping the text colorful & near seed.
  let text = initialText;
  let bg = bgSeed;
  let cr = bg.contrast(text);
  let level = initialLevel;

  if (
    (initialLevel === "AAA" && cr < AAA) ||
    (initialLevel === "AA" && cr < AA)
  ) {
    // Re-search BG lightness against the chosen text
    const tL = text.toHsl().l;
    const bgSearch = searchTone(bgSeed, text, {
      target: initialLevel === "AAA" ? AAA : AA,
      lowL: Math.max(tL + 5, 70),
      highL: 98,
    });
    if (bgSearch) {
      bg = bgSearch.c;
      cr = bgSearch.cr;
    } else {
      cr = bg.contrast(text);
    }
  }

  if (cr < AA) {
    // neutral fallback: choose the **lightest dark gray** that passes AA vs bg
    const nf = searchNeutralTextForAA(bg, AA);
    const textNeutral = nf.c;
    const crNeutral = nf.cr;

    // replace text/cr with neutral solution
    if (crNeutral >= AA) {
      text = textNeutral;
      cr = crNeutral;
      level = cr >= AAA ? "AAA" : "AA";
    }
  }

  // Border = mid L between bg/text (slight desat)
  const midL = (bg.toHsl().l + text.toHsl().l) / 2;
  const border = softenBg(setLightness(base, midL), 0.25);

  return {
    primary: base.toHex(),
    background: bg.toHex(),
    text: text.toHex(), // stays on-hue & saturated
    border: border.toHex(),
    contrastRatio: Number(cr.toFixed(2)),
    level,
  };
};

export default getPleasingColors;
export type { PleasingColorScheme };
