# Roam Release Process

This document describes the current Roam release process with Linear Releases,
GitHub Actions, and Roam Depot.

## Operator Checklist

This checklist is authoritative. Use a Linear release checklist issue to track
ownership and completion of each step, while following the ordering here. Record
links to the Linear release, changelog PR, and Roam Depot PR in that issue.

- [ ] Add the Linear release checklist issue to the current release.
- [ ] Review the Linear release contents and remove stale or incorrectly
      included tasks.
- [ ] Generate the release notes using Linear Agent.
- [ ] Verify `apps/roam/package.json` matches the version being released.
- [ ] Curate the notes, add the release entry to `apps/roam/CHANGELOG.md`, and
      merge the changelog PR.
- [ ] Run `Update Roam Extension Metadata` from `main`, confirm it opens the
      upstream Roam Depot PR, and confirm the Linear release is
      `Sent to Roam for Review`. Link the PR in the Linear release checklist issue.
- [ ] After the workflow succeeds, create the next Linear release, move it to
      `In Progress`, and merge the next-version package bump. Do not bump to the
      next version before the workflow submits the current version.
- [ ] Create a Linear Pulse in
      [Roam Discourse Graph plugin assorted tasks](https://linear.app/discourse-graphs/project/roam-discourse-graph-plugin-assorted-tasks-d8f4006c02ed/overview)
      that links to the Linear release checklist issue.
- [ ] Subscribe to the Roam Depot PR so you know when Roam merges it.
- [ ] After Roam publishes the extension, run `Complete Roam Linear Release` and
      confirm the Linear release is `Released`.
- [ ] Confirm the Linear release checklist issue status is `Released`.

The detailed sections below provide the supporting instructions for each step.

## Release Tracking Model

Roam uses a scheduled Linear release pipeline. At any time, there should be one
active Roam release collecting new work. After a release is submitted to Roam for
review, that release is frozen and a new release should be created manually for
the next version.

After the `roam-release.yaml` workflow moves a release to
`Sent to Roam for Review` in Linear:

1. Create the next Roam release manually in the Roam Linear release pipeline.
2. Use the next version number, such as `0.20.0`.
3. Move that new Linear release to `In Progress`.
4. Bump `apps/roam/package.json` to that next version in a follow-up PR.

The post-submission package bump must happen after `roam-release.yaml` runs,
because that workflow reads `apps/roam/package.json` for the version being sent
to Roam. Once the next release is in progress and the package version has been
bumped, the `roam-main.yaml` workflow automatically syncs eligible merged work
into that release when commits land on `main` and touch Roam-related paths such
as `apps/roam/**`.

## Preparing Release Notes

Before publishing a Roam release:

1. Bump `apps/roam/package.json` to the release version being submitted.
2. Create a PR for that version bump.
3. Generate release notes from the Linear release. The Linear Agent can generate
   these from the issues included in the Linear release.
4. Add the final user-facing release notes to `apps/roam/CHANGELOG.md`.
5. Create a PR for the changelog update, or include it with the version bump if
   that is how the release is being prepared.

Keep the changelog concise and user-facing. Internal chores, release-process
tasks, telemetry-only work, and build-only work should usually stay out of the
public changelog. See `apps/roam/CHANGELOG.md` for the current changelog format.

## Submitting to Roam

The Roam release workflow synchronizes the Discourse Graphs Roam Depot fork's
default branch with upstream before reading or updating the extension metadata.
If GitHub reports a sync conflict, resolve the fork conflict in GitHub and rerun
the workflow. The workflow does not update extension metadata when synchronization
fails.

The workflow uses the GitHub App for writes to the Discourse Graphs fork and the
`ROAM_RELEASE_TOKEN` organization secret to open or reuse the cross-fork pull
request in `Roam-Research/roam-depot`.

When the version bump and changelog are merged:

1. Run the `Update Roam Extension Metadata` GitHub Action
   (`.github/workflows/roam-release.yaml`) from `main`.
2. The workflow stops before changing Linear or Roam Depot if it is not running
   from `main`, if `apps/roam/CHANGELOG.md` has no section matching the version in
   `apps/roam/package.json`, or if that section has no release notes. Follow the
   error annotation, merge the missing preparation to `main`, and rerun the
   workflow from `main`.
3. Confirm the workflow succeeds and review its job summary for the submitted
   version, source commit, Linear release, Roam Depot pull request, and remaining
   manual steps.
4. The workflow updates Roam Depot metadata, opens or reuses the upstream Roam
   Depot PR, and moves the Linear release to `Sent to Roam for Review`. Link the
   PR from the workflow summary in the Linear release checklist issue.
5. Treat the release as frozen in Linear.
6. Create the next Roam Linear release, move it to `In Progress`, and bump
   `apps/roam/package.json` to that next version in a follow-up PR. Merge that PR
   to keep the alpha branch and release metadata aligned with the active release
   line.
7. Create a Linear Pulse in
   [Roam Discourse Graph plugin assorted tasks](https://linear.app/discourse-graphs/project/roam-discourse-graph-plugin-assorted-tasks-d8f4006c02ed/overview)
   that links to the Linear release checklist issue.
8. Subscribe to the Roam Depot PR.

At this point the release is submitted for Roam review, but it is not finished.

## Completing the Release

After Roam publishes the extension:

1. Run `Complete Roam Linear Release`
   (`.github/workflows/roam-release-complete.yaml`) with the release version.
2. Confirm the Linear release changed from `Sent to Roam for Review` to
   `Released`.
3. Confirm the Linear release checklist issue status is `Released`.
4. Confirm the next Linear release is already `In Progress` and
   `apps/roam/package.json` is already bumped to that next version.

Creating the next in-progress Linear release and bumping the Roam package version
after submission is required so future Roam commits can be collected
automatically by `roam-main.yaml` and reflected with the correct alpha/release
version.

## Workflow Responsibilities

`roam-main.yaml`

- Runs on `main` when Roam-related paths change.
- Builds and deploys the Roam blob-storage build.
- Syncs matching commits/issues into the current in-progress Linear release.
- Does not set a release version from `apps/roam/package.json`.

`roam-release.yaml`

- Runs manually when publishing a prepared release.
- Requires the workflow to run from `main` with a matching, non-empty changelog
  section for the package version before any release mutation.
- Builds Roam.
- Reads the release version from `apps/roam/package.json`.
- Synchronizes the Roam Depot fork with upstream, updates its metadata, and opens
  or reuses the upstream Roam Depot PR.
- Moves the Linear release to `Sent to Roam for Review`.
- Writes a successful job summary with release links and the remaining manual
  steps.

`roam-release-complete.yaml`

- Runs manually after Roam accepts or publishes the release.
- Completes the explicit Linear release version passed as workflow input.
