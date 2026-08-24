import { describe, expect, it, vi } from "vitest";
import {
  publish,
  type GitHubClient,
  type PublishResult,
} from "../../../scripts/publish";

const createApiError = ({
  status,
  message,
}: {
  status: number;
  message: string;
}): Error & { status: number } => Object.assign(new Error(message), { status });

const publishWithClient = async (
  octokit: GitHubClient,
): Promise<PublishResult> =>
  publish({
    octokit,
    upstreamOctokit: octokit,
    getCommitHash: () => Promise.resolve("abc123"),
    getPackageVersion: () => "1.2.3",
  });

describe("Roam Depot publishing", () => {
  it("uses separate clients for fork publishing and the upstream pull request", async () => {
    const forkRoutes: string[] = [];
    const forkRequest = vi.fn<GitHubClient["request"]>((route) => {
      forkRoutes.push(route);

      if (route === "GET /repos/{owner}/{repo}") {
        return Promise.resolve({
          data: { default_branch: "main" },
          status: 200,
        });
      }
      if (route === "POST /repos/{owner}/{repo}/merge-upstream") {
        return Promise.resolve({
          data: { merge_type: "fast-forward" },
          status: 200,
        });
      }
      if (route === "GET /repos/{owner}/{repo}/contents/{path}") {
        return Promise.resolve({
          data: { sha: "metadata-sha" },
          status: 200,
        });
      }
      return Promise.resolve({ data: {}, status: 200 });
    });
    const upstreamRoutes: string[] = [];
    const upstreamRequest = vi.fn<GitHubClient["request"]>((route) => {
      upstreamRoutes.push(route);

      if (route === "GET /repos/{owner}/{repo}/pulls") {
        return Promise.resolve({ data: [], status: 200 });
      }
      if (route === "POST /repos/{owner}/{repo}/pulls") {
        return Promise.resolve({
          data: {
            html_url: "https://github.com/Roam-Research/roam-depot/pull/1",
          },
          status: 201,
        });
      }
      return Promise.resolve({ data: {}, status: 200 });
    });

    await publish({
      octokit: { request: forkRequest },
      upstreamOctokit: { request: upstreamRequest },
      getCommitHash: () => Promise.resolve("abc123"),
      getPackageVersion: () => "1.2.3",
    });

    expect(forkRoutes).toEqual([
      "GET /repos/{owner}/{repo}",
      "POST /repos/{owner}/{repo}/merge-upstream",
      "GET /repos/{owner}/{repo}/contents/{path}",
      "PUT /repos/{owner}/{repo}/contents/{path}",
    ]);
    expect(upstreamRoutes).toEqual([
      "GET /repos/{owner}/{repo}/pulls",
      "POST /repos/{owner}/{repo}/pulls",
    ]);
    expect(forkRequest).toHaveBeenNthCalledWith(
      2,
      "POST /repos/{owner}/{repo}/merge-upstream",
      {
        owner: "DiscourseGraphs",
        repo: "roam-depot",
        branch: "main",
      },
    );
    expect(upstreamRequest).toHaveBeenLastCalledWith(
      "POST /repos/{owner}/{repo}/pulls",
      {
        owner: "Roam-Research",
        repo: "roam-depot",
        title: "Discourse Graphs - Release 1.2.3",
        head: "DiscourseGraphs:main",
        base: "main",
        body: "Updates Discourse Graphs to release 1.2.3.",
      },
    );
  });

  it("updates and reuses an existing upstream pull request", async () => {
    const request = vi.fn<GitHubClient["request"]>((route) => {
      if (route === "GET /repos/{owner}/{repo}") {
        return Promise.resolve({
          data: { default_branch: "main" },
          status: 200,
        });
      }
      if (route === "GET /repos/{owner}/{repo}/contents/{path}") {
        return Promise.resolve({ data: { sha: "metadata-sha" }, status: 200 });
      }
      if (route === "GET /repos/{owner}/{repo}/pulls") {
        return Promise.resolve({
          data: [
            {
              html_url: "https://github.com/Roam-Research/roam-depot/pull/123",
              number: 123,
              title: "Discourse Graphs - Release 1.2.2",
            },
          ],
          status: 200,
        });
      }
      return Promise.resolve({ data: {}, status: 200 });
    });

    await expect(publishWithClient({ request })).resolves.toEqual({
      pullRequestUrl: "https://github.com/Roam-Research/roam-depot/pull/123",
    });
    expect(request).not.toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/pulls",
      expect.anything(),
    );
    expect(request).toHaveBeenCalledWith(
      "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner: "Roam-Research",
        repo: "roam-depot",
        pull_number: 123,
        title: "Discourse Graphs - Release 1.2.3",
        body: "Updates Discourse Graphs to release 1.2.3.",
      },
    );
  });

  it("does not read or write metadata when synchronization has conflicts", async () => {
    const routes: string[] = [];
    const request = vi.fn<GitHubClient["request"]>((route) => {
      routes.push(route);
      if (route === "GET /repos/{owner}/{repo}") {
        return Promise.resolve({
          data: { default_branch: "main" },
          status: 200,
        });
      }
      return Promise.reject(
        createApiError({ status: 409, message: "Conflict" }),
      );
    });

    await expect(publishWithClient({ request })).rejects.toThrow(
      "Resolve the fork conflicts in GitHub, then rerun the publish workflow. Metadata was not updated.",
    );
    expect(routes).toEqual([
      "GET /repos/{owner}/{repo}",
      "POST /repos/{owner}/{repo}/merge-upstream",
    ]);
  });

  it("reports other synchronization API failures without touching metadata", async () => {
    const routes: string[] = [];
    const request = vi.fn<GitHubClient["request"]>((route) => {
      routes.push(route);
      if (route === "GET /repos/{owner}/{repo}") {
        return Promise.resolve({
          data: { default_branch: "main" },
          status: 200,
        });
      }
      return Promise.reject(
        createApiError({
          status: 403,
          message: "Resource not accessible",
        }),
      );
    });

    await expect(publishWithClient({ request })).rejects.toThrow(
      "GitHub API returned 403: Resource not accessible. Verify the GitHub App permissions and fork state, then rerun the publish workflow. Metadata was not updated.",
    );
    expect(routes).toEqual([
      "GET /repos/{owner}/{repo}",
      "POST /repos/{owner}/{repo}/merge-upstream",
    ]);
  });
});
