import esbuild from "esbuild";
import dotenv from "dotenv";
import { compile, args } from "./compile";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import axios from "axios";

dotenv.config();

type ExtensionMetadata = {
  name: string;
  short_description: string;
  author: string;
  tags?: string[];
  source_url: string;
  source_repo: string;
  source_commit: string;
  source_subdir?: string;
  stripe_account?: string; // for payouts from Roam
};

const getVersion = (root = "."): string => {
  const filename = path.join(root, "package.json");
  const json = fs.existsSync(filename)
    ? JSON.parse(fs.readFileSync(filename).toString())
    : {};
  if (!json?.version) throw new Error(`No version found in ${filename}`);
  return json.version;
};

const publish = async () => {
  process.env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "production",
  };

  console.log("Compiling ...");
  try {
    await compile({});
  } catch (error) {
    console.error("Compile failed:", error);
    process.exit(1);
  }

  console.log("Publishing ...");
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not set");

    const username = "DiscourseGraphs";
    const publishRepo = "roam-depot";
    const destPath = `extensions/${username}/discourse-graph`;
    const version = getVersion();
    const message = "Release " + version;

    const metadata: ExtensionMetadata = {
      name: "Discourse Graph",
      short_description:
        "A tool and ecosystem for collaborative knowledge synthesis",
      author: "The Discourse Graphs Project",
      source_url: `https://github.com/DiscourseGraphs/discourse-graph`,
      source_repo: `https://github.com/DiscourseGraphs/discourse-graph.git`,
      source_commit: "latest",
      source_subdir: "apps/roam",
    };
    const fileContent = JSON.stringify(metadata, null, 2);
    const base64Content = btoa(fileContent);

    const opts = {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };
    const url = `https://api.github.com/repos/${username}/${publishRepo}/contents/${destPath}.json`;
    const data = {
      message,
      content: base64Content,
    };

    console.log(`Updating json at ${publishRepo}/${destPath} to github`);
    try {
      await axios.put(url, data, opts);
    } catch (error) {
      console.error("Failed to post to github", error);
      process.exit(1);
    }
  } catch (error) {
    console.error("Failed", error);
    process.exit(1);
  }
};

const main = async () => {
  try {
    await publish();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

if (require.main === module) main();
