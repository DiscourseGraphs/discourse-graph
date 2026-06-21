# Roam Release Process

This document describes the current Roam release process with Linear Releases,
GitHub Actions, and Roam Depot.

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
4. Create or update a Linear Pulse/project update manually if the release notes
   should appear in Pulse. Do not assume Linear Releases automatically publish to
   Pulse.
5. Add the final user-facing release notes to `apps/roam/CHANGELOG.md`.
6. Create a PR for the changelog update, or include it with the version bump if
   that is how the release is being prepared.

Keep the changelog concise and user-facing. Internal chores, release-process
tasks, telemetry-only work, and build-only work should usually stay out of the
public changelog. See `apps/roam/CHANGELOG.md` for the current changelog format.

## Submitting to Roam

Before running the Roam release workflow, make sure the Discourse Graphs Roam
Depot fork is clean and up to date with upstream Roam Depot. The workflow updates
the Roam Depot metadata from the fork, so pending fork drift can complicate the
review PR.

When the version bump and changelog are merged:

1. Run the `Update Roam Extension Metadata` GitHub Action
   (`.github/workflows/roam-release.yaml`) from `main`.
2. Confirm the workflow succeeds.
3. The workflow updates Roam Depot metadata and moves the Linear release to
   `Sent to Roam for Review`.
4. Treat the release as frozen in Linear.
5. Create the next Roam Linear release, move it to `In Progress`, and bump
   `apps/roam/package.json` to that next version in a follow-up PR. This keeps
   the alpha branch and release metadata aligned with the active release line.
6. Cut the Roam Depot PR to Roam.

At this point the release is submitted for Roam review, but it is not finished.

## Completing the Release

After the Roam Depot PR is merged by Roam:

1. Confirm the extension has been accepted or published by Roam.
2. Change the Linear release from `Sent to Roam for Review` to `Released`.
3. If using the manual completion workflow, run `Complete Roam Linear Release`
   (`.github/workflows/roam-release-complete.yaml`) with the release version.
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
- Builds Roam.
- Reads the release version from `apps/roam/package.json`.
- Updates Roam Depot metadata.
- Moves the Linear release to `Sent to Roam for Review`.

`roam-release-complete.yaml`

- Runs manually after Roam accepts or publishes the release.
- Completes the explicit Linear release version passed as workflow input.
