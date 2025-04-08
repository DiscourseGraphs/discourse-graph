import getCurrentUserEmail from "roamjs-components/queries/getCurrentUserEmail";
import { OnloadArgs } from "roamjs-components/types";

type FeedbackWidget = {
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
      defaultButton?: {
        icon?: string;
      };
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
};

declare global {
  interface Window {
    birdeatsbug?: FeedbackWidget | any[];
  }
}

const STYLE_ID = "feedback-button-hiding-styles";

const addFeedbackButtonHidingStyles = () => {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.id = STYLE_ID;
  styleElement.textContent = `
    #birdeatsbug-sdk,
    #birdeatsbug-default-button {
      display: none !important;
    }
  `;

  document.head.appendChild(styleElement);
};

const removeFeedbackButtonHidingStyles = () => {
  const styleElement = document.getElementById(STYLE_ID);
  if (styleElement) {
    styleElement.remove();
  }
};

export const initFeedbackWidget = (
  extensionAPI: OnloadArgs["extensionAPI"],
): void => {
  if (extensionAPI.settings.get("hide-feedback-button") as boolean) {
    addFeedbackButtonHidingStyles();
    return;
  }

  removeFeedbackButtonHidingStyles();

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

  const customStyles = document.createElement("style");
  customStyles.textContent = `
   
    #birdeatsbug-sdk {
      --distance-to-window-edge-vertical: 50px;
      --distance-to-window-edge-horizontal: 20px;
    }
    
    #birdeatsbug-sdk .form-error {
      font-size: 1.2rem;
    }
    
    #birdeatsbug-sdk:has(.screen) {
      box-shadow: none !important;
      border-radius: 0 !important;
      border: none !important;
    }
    
    #birdeatsbug-sdk.dark {
      --button-primary-bg-color: #1976d2;
    }

    button#birdeatsbug-default-button.button {
      font-weight: 600;
      font-size: 15px;
    }

    #birdeatsbug-default-button::before {
      content: "";
      display: inline-block;
      width: 20px;
      height: 20px;
      background-image: url("data:image/svg+xml,%3Csvg width='256' height='264' viewBox='0 0 256 264' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M156.705 252.012C140.72 267.995 114.803 267.995 98.8183 252.012L11.9887 165.182C-3.99622 149.197 -3.99622 123.28 11.9886 107.296L55.4035 63.8807C63.3959 55.8881 76.3541 55.8881 84.3467 63.8807C92.3391 71.8731 92.3391 84.8313 84.3467 92.8239L69.8751 107.296C53.8901 123.28 53.8901 149.197 69.8751 165.182L113.29 208.596C121.282 216.589 134.241 216.589 142.233 208.596C150.225 200.604 150.225 187.646 142.233 179.653L127.761 165.182C111.777 149.197 111.777 123.28 127.761 107.296C143.746 91.3105 143.746 65.3939 127.761 49.4091L113.29 34.9375C105.297 26.9452 105.297 13.9868 113.29 5.99432C121.282 -1.99811 134.241 -1.99811 142.233 5.99434L243.533 107.296C259.519 123.28 259.519 149.197 243.533 165.182L156.705 252.012ZM200.119 121.767C192.127 113.775 179.168 113.775 171.176 121.767C163.184 129.76 163.184 142.718 171.176 150.71C179.168 158.703 192.127 158.703 200.119 150.71C208.112 142.718 208.112 129.76 200.119 121.767Z' fill='%23FFFFFF'/%3E%3C/svg%3E");
      background-size: contain;
      background-repeat: no-repeat;
      margin-right: 8px;
      vertical-align: middle;
    }

    #birdeatsbug-sdk .caret {
      height: initial;
      width: initial; 
      border-top: initial;
    }
  `;

  document.head.appendChild(customStyles);

  if (window.birdeatsbug && "setOptions" in window.birdeatsbug) {
    window.birdeatsbug.setOptions!({
      publicAppId: "faf02e48-84b7-4292-b76c-03d9342ba9aa",
      user: {
        email: getCurrentUserEmail(),
      },
      ui: {
        position: "bottom-right",
        defaultButton: { icon: undefined },
        text: {
          defaultButton: "Send feedback",
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

export const hideFeedbackButton = addFeedbackButtonHidingStyles;
export const showFeedbackButton = removeFeedbackButtonHidingStyles;
