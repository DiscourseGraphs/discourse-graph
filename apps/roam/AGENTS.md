You are working on the Roam Research extension that implements the Discourse Graph protocol.

## Dependencies

Prefer existing dependencies from package.json.

## Roam Style Guide

Platform-native UI - use BlueprintJS 3 components and Tailwind CSS.
Do not introduce arbitrary visual styling, new shading colors, background palettes, gradients, accent colors, border colors, or text colors unless the user explicitly asks for them.
When styling Roam UI, use this priority order:

1. Use basic BlueprintJS patterns and components first.
2. Reuse existing repo examples and established Tailwind styling patterns before adding anything new.
3. Fall back to Roam-native styling and colors.

Any new Roam UI should feel native to Roam and consistent with existing BlueprintJS and repository usage, not like a separate visual palette.
Use the roamAlphaApi docs from https://roamresearch.com/#/app/developer-documentation/page/tIaOPdXCj.
Use Roam Depot/Extension API docs from https://roamresearch.com/#/app/developer-documentation/page/y31lhjIqU.
