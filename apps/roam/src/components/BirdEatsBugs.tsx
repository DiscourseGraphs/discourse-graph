import getCurrentUserEmail from "roamjs-components/queries/getCurrentUserEmail";

// Option types detailed in https://docs.birdeatsbug.com/latest/sdk/options.html

export type FeedbackWidget = {
  initialize?: boolean;
  invoked?: boolean;
  methods?: string[];
  factory?: (method: string) => (...args: any[]) => FeedbackWidget;
  load?: () => void;
  push?: (args: any[]) => void;
  setOptions?: (options: {
    user?: {
      email?: string;
    };
    publicAppId: string;
    ui?: {
      position?: string;
      defaultButton?:
        | {
            icon?: string;
          }
        | boolean;
      text?: {
        defaultButton?: string;
        previewScreen?: {
          title?: string;
        };
      };
      previewScreen?: {
        title?: "required" | "optional" | boolean;
        description?: "required" | "optional" | boolean;
      };
      watermark?: boolean;
    };
  }) => void;
  [key: string]: any;
  length?: number;
  trigger?: () => FeedbackWidget;
};

declare global {
  interface Window {
    birdeatsbug?: FeedbackWidget | any[];
  }
}

export const initFeedbackWidget = (): void => {
  const birdeatsbug = (window.birdeatsbug =
    window.birdeatsbug || []) as FeedbackWidget;

  if (birdeatsbug.initialize) return;

  if (birdeatsbug.invoked) {
    if (window.console && console.error) {
      console.error("birdeatsbug snippet included twice.");
    }
    return;
  }

  birdeatsbug.invoked = true;

  birdeatsbug.methods = [
    "setOptions",
    "trigger",
    "resumeSession",
    "takeScreenshot",
    "startRecording",
    "stopRecording",
    "stopSession",
    "uploadSession",
    "deleteSession",
  ];

  birdeatsbug.factory = (method) => {
    return function () {
      const args = Array.prototype.slice.call(arguments);
      args.unshift(method);
      birdeatsbug.push?.(args);
      return birdeatsbug;
    };
  };

  for (let i = 0; i < birdeatsbug.methods.length; i++) {
    const key = birdeatsbug.methods[i];
    birdeatsbug[key] = birdeatsbug.factory(key);
  }

  birdeatsbug.load = () => {
    const script = document.createElement("script");
    script.type = "module";
    script.async = true;
    script.src = "https://sdk.birdeatsbug.com/v3/core.js";

    const mountJsBefore =
      document.getElementsByTagName("script")[0] || document.body.firstChild;
    mountJsBefore.parentNode?.insertBefore(script, mountJsBefore);

    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.type = "text/css";
    style.href = "https://sdk.birdeatsbug.com/v3/style.css";

    const mountCssBefore =
      document.querySelector('link[rel="stylesheet"]') || mountJsBefore;
    mountCssBefore.parentNode?.insertBefore(style, mountCssBefore);
  };

  birdeatsbug.load();

  if (window.birdeatsbug && "setOptions" in window.birdeatsbug) {
    window.birdeatsbug.setOptions!({
      publicAppId: "faf02e48-84b7-4292-b76c-03d9342ba9aa",
      user: {
        email: getCurrentUserEmail(),
      },
      ui: {
        position: "bottom-right",
        defaultButton: false, // hide, will be triggered in DiscourseFloatingMenu
        text: {
          previewScreen: {
            title: "Discourse Graphs feedback",
          },
        },
        previewScreen: {
          title: "required",
          description: "required",
        },
        watermark: false,
      },
    });
  }
};
