import { describe, expect, it, vi } from "vitest";
import { publish, type GitHubClient } from "../../../scripts/publish";

const createApiError = ({
  status,
  message,
}: {
  status: number;
  message: string;
}): Error & { status: number } => Object.assign(new Error(message), { status });

const publishWithClient = async (octokit: GitHubClient): Promise<void> =>
  publish({
    octokit,
    getCommitHash: () => Promise.resolve("abc123"),
    getPackageVersion: () => "1.2.3",
  });

describe("Roam Depot publishing", () => {
  it("synchronizes the fork's default branch before reading and updating metadata", async () => {
    const routes: string[] = [];
    const request = vi.fn<GitHubClient["request"]>((route) => {
      routes.push(route);

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

    await publishWithClient({ request });

    expect(routes).toEqual([
      "GET /repos/{owner}/{repo}",
      "POST /repos/{owner}/{repo}/merge-upstream",
      "GET /repos/{owner}/{repo}/contents/{path}",
      "PUT /repos/{owner}/{repo}/contents/{path}",
    ]);
    expect(request).toHaveBeenNthCalledWith(
      2,
      "POST /repos/{owner}/{repo}/merge-upstream",
      {
        owner: "DiscourseGraphs",
        repo: "roam-depot",
        branch: "main",
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
