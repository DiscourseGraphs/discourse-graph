---
name: roam-global-tailwind
description: Use Roam Research's globally loaded Tailwind CSS safely in RoamJS extensions. Trigger when Codex writes, reviews, or refactors Roam extension UI that relies on Roam's global Tailwind utility classes; checks whether utilities, responsive or state variants, arbitrary syntax, newer Tailwind names, colors, or important modifiers are available; or decides whether styling must instead live in extension-owned CSS or a separately compiled Tailwind bundle.
---

# Roam global Tailwind

Distinguish Roam's global stylesheet from CSS compiled by the current project. Apply this skill only to classes that rely on Roam's globally loaded `tailwind.min.css`; inspect the repository first when that scope is unclear.

## Choose the styling source

1. Use the project's own Tailwind configuration and generated CSS when the project compiles the class itself.
2. Otherwise, treat the class as dependent on Roam's global stylesheet.
3. Read [references/compatibility.md](references/compatibility.md) before selecting or reviewing global classes.
4. Run `node scripts/check-classes.mjs <class...>` for any class not explicitly confirmed in the reference, and whenever current live behavior matters.

Do not infer that a whole variant family is available from one confirmed class. Check complete class names because Roam's generated variants are utility-specific.

## Handle unavailable classes

- Prefer a confirmed Roam-global utility with equivalent behavior.
- Add extension-scoped CSS when no confirmed global utility exists.
- Compile the project's own Tailwind CSS only when the repository already owns or intentionally adopts that build path.
- Do not use `!utility` syntax against Roam's global stylesheet. Use narrowly scoped extension CSS with `!important` only when the cascade requires it.

## Respond to stylesheet drift

The checker compares the live file with the verified snapshot hash. If it reports drift:

1. Trust each checker's per-class result for that fetched file.
2. Treat the static compatibility reference and version fingerprint as historical, not current.
3. Avoid broad claims about newly available utility families.
4. Report the new hash and recommend rerunning the full historical comparison before updating the reference.

## Verify UI work

After changing user-facing styling, run the project's tests and build, then inspect the rendered UI in Roam. Confirm the target class appears in the DOM and the expected computed style wins the cascade.
