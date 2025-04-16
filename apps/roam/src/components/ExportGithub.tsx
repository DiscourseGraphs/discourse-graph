import { Button } from "@blueprintjs/core";
import nanoid from "nanoid";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import apiGet from "roamjs-components/util/apiGet";
import apiPost from "roamjs-components/util/apiPost";
import { getNodeEnv } from "roamjs-components/util/env";
import { getSetting, setSetting } from "~/utils/settings";

type UserReposResponse = {
  data: [
    {
      name: string;
      full_name: string;
    },
  ];
  status: number;
};
type UserRepos = UserReposResponse["data"];
const initialRepos: UserRepos = [{ name: "", full_name: "" }];

const WINDOW_WIDTH = 600;
const WINDOW_HEIGHT = 525;
const WINDOW_LEFT = window.screenX + (window.innerWidth - WINDOW_WIDTH) / 2;
const WINDOW_TOP = window.screenY + (window.innerHeight - WINDOW_HEIGHT) / 2;

export const ExportGithub = ({
  isVisible,
  selectedRepo,
  setSelectedRepo,
  setError,
  gitHubAccessToken,
  setGitHubAccessToken,
  setCanSendToGitHub,
}: {
  isVisible: boolean;
  selectedRepo: string;
  setSelectedRepo: (selectedRepo: string) => void;
  setError: (error: string) => void;
  gitHubAccessToken: string | null;
  setGitHubAccessToken: (gitHubAccessToken: string | null) => void;
  setCanSendToGitHub: (canSendToGitHub: boolean) => void;
}) => {
  const authWindow = useRef<Window | null>(null);

  const [isGitHubAppInstalled, setIsGitHubAppInstalled] = useState(false);
  const [clickedInstall, setClickedInstall] = useState(false);
  const [repos, setRepos] = useState<UserRepos>(initialRepos);
  const [state, setState] = useState("");
  const showGitHubLogin = isGitHubAppInstalled && !gitHubAccessToken;
  const repoSelectEnabled = isGitHubAppInstalled && gitHubAccessToken;

  // const isDev = useMemo(() => getNodeEnv() === "development", []);
  const isDev = false;
  const setRepo = (repo: string) => {
    setSelectedRepo(repo);
    setSetting("selected-repo", repo);
  };

  const handleReceivedAccessToken = (token: string) => {
    console.log("Received GitHub token:", !!token);

    // Store in both localStorage and extension settings for maximum compatibility
    localStorage.setItem("oauth-github", token);
    setSetting("oauth-github", token);

    setGitHubAccessToken(token);
    setClickedInstall(false);
    authWindow.current?.close();
  };

  const fetchAndSetInstallation = useCallback(async () => {
    try {
      // Try to get token directly from both sources
      const tokenFromSettings = getSetting<string>("oauth-github", "");
      const tokenFromLocalStorage = localStorage.getItem("oauth-github");
      const token = tokenFromSettings || tokenFromLocalStorage || "";

      console.log(
        "Using GitHub token from:",
        tokenFromSettings
          ? "extension settings"
          : tokenFromLocalStorage
            ? "localStorage"
            : "nowhere",
      );

      if (!token) {
        console.error("No GitHub token found in any storage location");
        return false;
      }

      const res = await apiGet<{ installations: { app_id: number }[] }>({
        domain: "https://api.github.com",
        path: "user/installations",
        headers: {
          Authorization: `token ${token}`,
        },
      });

      const installations = res.installations;
      const APP_ID = isDev ? 882491 : 312167; // TODO - pull from process.env.GITHUB_APP_ID
      const isAppInstalled = installations.some(
        (installation) => installation.app_id === APP_ID,
      );

      console.log(
        "GitHub app installations:",
        installations.length,
        "App ID:",
        APP_ID,
      );
      setIsGitHubAppInstalled(isAppInstalled);
      return isAppInstalled;
    } catch (error) {
      const e = error as Error;
      console.error("GitHub installation check error:", e.message);

      if (e.message === "Bad credentials") {
        setGitHubAccessToken(null);
        setSetting("oauth-github", "");
        localStorage.removeItem("oauth-github");
      }
      return false;
    }
  }, []);

  // listen for messages from the auth window
  useEffect(() => {
    // Create a stable state value that persists between renders
    if (!state) {
      const otp = nanoid().replace(/_/g, "-");
      const key = nanoid().replace(/_/g, "-");
      const newState = `github_${otp}_${key}`;
      console.log("Setting GitHub OAuth state:", newState);
      setState(newState);
      // Store state in localStorage to preserve it across page refreshes
      localStorage.setItem("github-oauth-state", newState);
    }

    const handleGitHubAuthMessage = (event: MessageEvent) => {
      const targetOrigin = isDev
        ? "https://samepage.ngrok.io"
        : "https://samepage.network";
      console.log(
        "Received auth message:",
        !!event.data,
        "from:",
        event.origin,
        "expected:",
        targetOrigin,
      );
      if (event.data && event.origin === targetOrigin) {
        handleReceivedAccessToken(event.data);
      }
    };

    if (isVisible) {
      window.addEventListener("message", handleGitHubAuthMessage);
    }

    return () => {
      if (isVisible) {
        window.removeEventListener("message", handleGitHubAuthMessage);
      }
    };
  }, [isVisible, state]);

  // check for installation
  useEffect(() => {
    if (gitHubAccessToken) fetchAndSetInstallation();
  }, [gitHubAccessToken]);

  // get the list of repos
  useEffect(() => {
    if (!gitHubAccessToken || !isGitHubAppInstalled) return;
    const fetchAndSetRepos = async () => {
      try {
        const res = await apiGet<UserReposResponse>({
          domain: "https://api.github.com",
          path: "user/repos?per_page=100&type=owner",
          headers: {
            Authorization: `token ${gitHubAccessToken}`,
          },
        });
        setError("");
        setRepos(res.data);
      } catch (error) {
        setError("Failed to fetch repositories");
      }
    };
    fetchAndSetRepos();
  }, [gitHubAccessToken, isGitHubAppInstalled]);

  // gatekeep export button
  useEffect(() => {
    if (gitHubAccessToken && isGitHubAppInstalled && selectedRepo) {
      setCanSendToGitHub(true);
    }
  }, [gitHubAccessToken, isGitHubAppInstalled, selectedRepo]);

  const handleAuthButtonClick = async () => {
    // Get the stored state or create a new one
    const currentState =
      state || localStorage.getItem("github-oauth-state") || "";
    console.log("Using OAuth state:", currentState);

    const params = isDev
      ? `client_id=Iv1.4bf062a6c6636672&state=${currentState}`
      : `client_id=Iv1.e7e282a385b7b2da&state=${currentState}`;

    authWindow.current = window.open(
      `https://github.com/login/oauth/authorize?${params}`,
      "_blank",
      `width=${WINDOW_WIDTH}, height=${WINDOW_HEIGHT}, top=${WINDOW_TOP}, left=${WINDOW_LEFT}`,
    );

    let attemptCount = 0;
    const check = () => {
      if (attemptCount < 30) {
        const apiDomain = isDev
          ? "https://api.samepage.ngrok.io"
          : "https://api.samepage.network";

        console.log(
          `Attempt ${attemptCount + 1}/30: Checking for token at ${apiDomain}/access-token`,
        );

        apiPost({
          path: "access-token",
          domain: apiDomain,
          data: { state: currentState },
        })
          .then((r) => {
            console.log(
              "Token API response:",
              r.accessToken ? "has token" : "no token",
            );
            if (r.accessToken) {
              handleReceivedAccessToken(r.accessToken);
            } else {
              attemptCount++;
              setTimeout(check, 1000);
            }
          })
          .catch((err) => {
            console.error("Token check error:", err);
            attemptCount++;
            setTimeout(check, 1000);
          });
      } else {
        setError("Something went wrong. Please try again or contact support.");
      }
    };
    setTimeout(check, 1500);
  };

  if (!isVisible) return null;
  return (
    <div className="mb-4 flex">
      <div className="flex flex-col">
        {!isGitHubAppInstalled && (
          <Button
            text="Install SamePage App"
            id="qb-install-button"
            icon="cloud-download"
            className={clickedInstall ? "opacity-30 hover:opacity-100" : ""}
            intent={clickedInstall ? "none" : "primary"}
            onClick={async () => {
              authWindow.current = window.open(
                isDev
                  ? "https://github.com/apps/samepage-network-dev"
                  : "https://github.com/apps/samepage-network",
                "_blank",
                `width=${WINDOW_WIDTH}, height=${WINDOW_HEIGHT}, top=${WINDOW_TOP}, left=${WINDOW_LEFT}`,
              );
              setClickedInstall(true);
              document.getElementById("qb-install-button")?.blur();
            }}
          />
        )}
        {clickedInstall && (
          <Button
            text="Confirm Installation"
            icon="confirm"
            intent="primary"
            onClick={async () => {
              setClickedInstall(false);
              setIsGitHubAppInstalled(true);
            }}
          />
        )}
      </div>
      {showGitHubLogin && (
        <Button
          text="Authorize"
          icon="key"
          intent="primary"
          onClick={handleAuthButtonClick}
        />
      )}
      {repoSelectEnabled && (
        <MenuItemSelect
          items={repos.map((repo) => repo.full_name)}
          onItemSelect={setRepo}
          activeItem={selectedRepo}
          filterable={true}
          transformItem={(item) => item.split("/")[1]}
          emptyValueText="Choose Repo"
        />
      )}
    </div>
  );
};
