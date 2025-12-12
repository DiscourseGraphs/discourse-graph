import { Button } from "@blueprintjs/core";
import nanoid from "nanoid";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import apiGet from "roamjs-components/util/apiGet";
import apiPost from "roamjs-components/util/apiPost";
import { getNodeEnv } from "roamjs-components/util/env";
import { setSetting } from "~/utils/extensionSettings";

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

  const isDev = useMemo(() => getNodeEnv() === "development", []);
  const setRepo = (repo: string) => {
    setSelectedRepo(repo);
    void setSetting("selected-repo", repo).catch(() => undefined);
  };

  const handleReceivedAccessToken = (token: string): void => {
    void setSetting("oauth-github", token).catch(() => undefined);
    setGitHubAccessToken(token);
    setClickedInstall(false);
    authWindow.current?.close();
  };

  const fetchAndSetInstallation = useCallback(async (token: string) => {
    try {
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

      setIsGitHubAppInstalled(isAppInstalled);
      return isAppInstalled;
    } catch (error) {
      const e = error as Error;

      if (e.message === "Bad credentials") {
        setGitHubAccessToken(null);
        void setSetting("oauth-github", "").catch(() => undefined);
      }
      return false;
    }
  }, []);

  // listen for messages from the auth window
  useEffect(() => {
    const otp = nanoid().replace(/_/g, "-");
    const key = nanoid().replace(/_/g, "-");
    const state = `github_${otp}_${key}`;
    setState(state);

    const handleGitHubAuthMessage = (event: MessageEvent) => {
      const targetOrigin = isDev
        ? "https://samepage.ngrok.io"
        : "https://samepage.network";
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
  }, [isVisible]);

  // check for installation
  useEffect(() => {
    if (gitHubAccessToken) fetchAndSetInstallation(gitHubAccessToken);
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
          onClick={async () => {
            const params = isDev
              ? `client_id=Iv1.4bf062a6c6636672&state=${state}`
              : `client_id=Iv1.e7e282a385b7b2da&state=${state}`;
            authWindow.current = window.open(
              `https://github.com/login/oauth/authorize?${params}`,
              "_blank",
              `width=${WINDOW_WIDTH}, height=${WINDOW_HEIGHT}, top=${WINDOW_TOP}, left=${WINDOW_LEFT}`,
            );

            let attemptCount = 0;
            const check = () => {
              if (attemptCount < 30) {
                apiPost({
                  path: "access-token",
                  domain: isDev
                    ? "https://api.samepage.ngrok.io"
                    : "https://api.samepage.network",
                  data: { state },
                }).then((r) => {
                  if (r.accessToken) {
                    handleReceivedAccessToken(r.accessToken);
                  } else {
                    attemptCount++;
                    setTimeout(check, 1000);
                  }
                });
              } else {
                setError("Something went wrong.  Please contact support.");
              }
            };
            setTimeout(check, 1500);
          }}
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
