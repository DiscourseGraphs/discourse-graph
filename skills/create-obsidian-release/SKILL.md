Create a release for the Discourse Graphs Obsidian plugin with version $ARGUMENTS.

Follow these steps:

## 1. Validate input

- The argument should be a semver version number (e.g. `0.5.4`). If not provided or invalid, ask the user.

## 2. Find the previous release

- Run: `gh release list --repo DiscourseGraphs/discourse-graph-obsidian --limit 5`
- Identify the most recent existing release (the one just before the new version being created).
- Note its tag name and published date.

## 3. Find Obsidian-related PRs since the last release

- Run: `gh pr list --repo DiscourseGraphs/discourse-graph --state merged --limit 100 --json number,title,mergedAt,labels --jq '.[]'` and filter to PRs merged **after** the previous release date.
- For each PR, check which files it touches: `gh pr view <number> --repo DiscourseGraphs/discourse-graph --json title,body,files`
- A PR is Obsidian-related if it touches files in `apps/obsidian/` or shared `packages/` used by Obsidian.
- Exclude PRs that only touch `apps/roam/`, CI workflows, or root dev tooling (prettier, eslint, husky configs) unless they meaningfully affect the Obsidian plugin.

## 4. Categorize the PRs

Group them into:

- **Features**: New functionality or meaningful enhancements
- **Bug Fixes**: Fixes to existing behavior
- **Internal**: Refactors, docs, dev tooling, plugin store compliance, README updates

## 5. Generate the changelog

Format it as:

```
# Changelog

## v{VERSION}

### Features

- **Short title**: Description ([#NNN](https://github.com/DiscourseGraphs/discourse-graph/pull/NNN))

### Bug Fixes

- **Short title**: Description ([#NNN](https://github.com/DiscourseGraphs/discourse-graph/pull/NNN))

### Internal

- **Short title**: Description ([#NNN](https://github.com/DiscourseGraphs/discourse-graph/pull/NNN))
```

Omit any section that has no entries.

## 6. Show the changelog to the user and ask for confirmation

Present the generated changelog and ask if they want to:

- Edit anything before publishing
- Proceed with creating/updating the release

## 7. Create or update the release

**Prerequisites:**

- `OBSIDIAN_PLUGIN_REPO_TOKEN` must be available — the script loads `apps/obsidian/.env` automatically via `dotenv`, so no manual `export` is needed as long as the token is in that file.

**Check if the release tag already exists:**

```
gh release view v{VERSION} --repo DiscourseGraphs/discourse-graph-obsidian
```

**If the release does NOT exist** — run the publish script. This builds the plugin, uploads the release assets (`main.js`, `manifest.json`, `styles.css`), and creates the GitHub release:

```
cd apps/obsidian && tsx scripts/publish.ts --version {VERSION}
```

The script auto-generates release notes from GitHub. After it completes, overwrite them with the curated changelog:

```
gh release edit v{VERSION} --repo DiscourseGraphs/discourse-graph-obsidian --notes "..."
```

**If the release ALREADY exists** — the assets are already uploaded. Do NOT re-run `publish.ts` (it will fail on duplicate tag). Instead, just update the release notes with the curated changelog:

```
gh release edit v{VERSION} --repo DiscourseGraphs/discourse-graph-obsidian --notes "..."
```

- Print the release URL when done.

## 8. Draft a Slack announcement

Based on the changelog, draft a user-facing release announcement for the `#obsidian-plugin` channel in the Discourse Graphs Slack.

**Rules for the Slack message:**

- Include only **Features** and **Bug Fixes** — omit anything categorized as **Internal** or that is not customer-facing
- If there are no user-facing changes, skip this step and say so

**Message format:**

```
:sparkles: *Discourse Graph v{VERSION} is out!*

Here's what's new:

*Features*
• *Short title*: Description

*Bug Fixes*
• *Short title*: Description

Full release notes: {RELEASE_URL}
```

Omit any section that has no entries.

**Sending the message:**

- If the Slack MCP (`mcp__plugin_slack_slack__slack_send_message`) is available:
  1. Search for the channel: use `slack_search_channels` with query `obsidian-plugin`
  2. Send as a **draft** using `slack_send_message_draft` so the dev can review before posting
  3. Show the draft link to the user
- If Slack MCP is not available:
  - Display the drafted message in full so the dev can copy-paste it into the `#obsidian-plugin` channel manually
