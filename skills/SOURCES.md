# Skill sources

These skills are vendored snapshots. They are not live-linked to upstream
repositories, so updates should be pulled intentionally and reviewed as normal
source changes.

| Local skill | Upstream GitHub source | Notes |
| --- | --- | --- |
| `turborepo` | https://github.com/vercel/turborepo/tree/main/skills/turborepo | Imported with its companion `command` and `references` files. |
| `next-best-practices` | https://github.com/vercel/vercel-plugin/tree/main/skills/nextjs | Vendored under the catalog/requested name `next-best-practices`; source content comes from Vercel's maintained Next.js skill. |
| `vercel-functions` | https://github.com/vercel/vercel-plugin/tree/main/skills/vercel-functions | Imported from the Vercel plugin skill source. |
| `shadcn` | https://github.com/vercel/vercel-plugin/tree/main/skills/shadcn | Imported from the Vercel plugin skill source for shadcn/ui guidance. |
| `react-best-practices` | https://github.com/vercel/vercel-plugin/tree/main/skills/react-best-practices | Imported with its companion `rules` and `AGENTS.md` files. |

The Vercel skills catalog entry for `next-best-practices` is
https://www.skills.sh/vercel/nextjs-skills/next-best-practices. The catalog
shows `vercel/nextjs-skills`, but the raw skill directory was not available
from that repository in the expected install shape during import, so the
maintained Vercel plugin Next.js source above was used.
